import builtins
import datetime
import io
import logging
import os
import sys
import time
import webview

from functools import partial

from config import KOLIBRI_IP
from config import KOLIBRI_PORT
from http.client import HTTPConnection
from http.client import NotConnected
from multiprocessing import freeze_support
from shutil import copy
from threading import Thread


EKAPP_DIR = os.path.dirname(os.path.realpath(__file__))
KOLIBRI_APPDIR = os.path.join(EKAPP_DIR, 'kolibri')
KOLIBRI_EXTENSIONS = os.path.join(KOLIBRI_APPDIR, 'dist')
KOLIBRI_HOME = os.path.join(os.path.expandvars('%APPDATA%'), 'kolibri-electron', 'endless-key')
KOLIBRI_ROOT_URL = 'http://localhost:{}'.format(KOLIBRI_PORT)
METRICS_ID = 'endless-key-windows'
AUTOPROVISION_FILE = os.path.join(EKAPP_DIR, 'automatic_provision.json')


class LoggerWriter(io.IOBase):
    def __init__(self, writer):
        self._writer = writer
        self._msg = ''

    def readable(self):
        return False
   
    def writable(self):
        return True

    def write(self, message):
        self._msg = self._msg + message
        while '\n' in self._msg:
            pos = self._msg.find('\n')
            self._writer(self._msg[:pos])
            self._msg = self._msg[pos+1:]

    def flush(self):
        if self._msg != '':
            self._writer(self._msg)
            self._msg = ''

def set_log():
    # initialize logging before loading any third-party modules, as they may cause logging to get configured.
    logging.basicConfig(level=logging.INFO)

    # Make sure we send all app output to logs as we have no console to view them on.
    sys.stdout = LoggerWriter(logging.debug)
    sys.stderr = LoggerWriter(logging.warning)

    extra_python_path = EKAPP_DIR
    sys.path.insert(0, extra_python_path)
    sys.path.insert(0, os.path.join(extra_python_path, "kolibri", "dist"))


class Application:
    max_retries = 40;

    def get_loading_screen(self):
        default_loading = os.path.join(KOLIBRI_APPDIR, 'assets', '_load.html')

        loading_url = os.path.join(
            KOLIBRI_EXTENSIONS,
            'kolibri_explore_plugin',
            'loadingScreen',
            'index.html')

        if os.path.isfile(loading_url):
            return loading_url

        return default_loading

    def run(self):
        window = webview.create_window(
            'Endless Key',
            self.get_loading_screen(),
            width=1024,
            height=768)

        window.events.closed += self.on_closed

        dev_extra = os.getenv('ENDLESS_KEY_APP_DEVELOPER_EXTRAS', default='0')
        debug_flag = dev_extra == '1'
        webview.start(self.on_open,
            args=(window,),
            private_mode=False,
            storage_path=KOLIBRI_HOME,
            debug=debug_flag)

    def _init_log(self):
        from kolibri.utils.logger import KolibriTimedRotatingFileHandler

        log_basename = "kolibri-app.txt"
        log_dir = os.path.join(os.environ['KOLIBRI_HOME'], 'logs')
        os.makedirs(log_dir, exist_ok=True)
        log_filename = os.path.join(log_dir, log_basename)
        root_logger = logging.getLogger()
        file_handler = KolibriTimedRotatingFileHandler(filename=log_filename, encoding='utf-8', when='midnight', backupCount=30)
        root_logger.addHandler(file_handler)

    def start_server(self):
        from kolibri_tools.utils import initialize_plugins
        from kolibri_tools.utils import start_kolibri_server

        self._init_log()

# Since the log files can contain multiple runs, make the first printout very visible to quickly show
# when a new run starts in the log files.
        logging.info("")
        logging.info("**************************************")
        logging.info("*  Kolibri Backend App Initializing  *")
        logging.info("**************************************")
        logging.info("")
        logging.info("Started at: {}".format(datetime.datetime.today()))

        # This is needed because in other case the extensions path is not
        # working correctly
        if os.environ.get('PYTHONPATH'):
            sys.path.append(os.environ['PYTHONPATH'])

        logging.info("Preparing to start Kolibri server...")
        initialize_plugins()
        start_kolibri_server()

    def wait_for_kolibri_up(self, window):
        for load_retries in range(self.max_retries):
            try:
                conn = HTTPConnection(f'localhost:{KOLIBRI_PORT}', timeout=10)
                conn.request('GET', '/api/public/info')
                res = conn.getresponse()
                window.load_url(f'{KOLIBRI_ROOT_URL}/explore')
                return
            except NotConnected as e:
                window.evaluate_js('LoadingApp.showLoadingRetry()')
                logging.info(e)
                time.sleep(3)
                continue
            except Exception as e:
                logging.error(e)

        window.evaluate_js('LoadingApp.showLoadingError()')

    def on_open(self, window):
        kolibri_t = Thread(
            target=self.start_server,
            daemon=True)
        kolibri_t.start()

        self.wait_for_kolibri_up(window)

    def on_closed(self):
        from kolibri_tools.utils import stop_kolibri_server

        stop_kolibri_server()
        # Give it some time to stop kolibri server
        time.sleep(5)


def create_dir(path):
    if not os.path.exists(path):
        os.makedirs(path)

def set_real_kolibri_home():
    global KOLIBRI_HOME

    # Create a temp file, then get its folder's real path as KOLIBRI_HOME path.
    fname = os.path.join(KOLIBRI_HOME, str(time.monotonic_ns()))
    with open(fname, 'x') as f:
        f.close()

    KOLIBRI_HOME = os.path.dirname(os.path.realpath(fname))
    os.remove(fname)

def setup_provision():
    # Copy the provision file because Kolibri removes after applying
    provision_file = os.path.join(EKAPP_DIR, 'provision.json')
    print(provision_file)
    if not os.path.isfile(provision_file):
        try:
            copy(AUTOPROVISION_FILE, provision_file)
        except:
            provision_file = AUTOPROVISION_FILE

    os.environ['KOLIBRI_AUTOMATIC_PROVISION_FILE'] = provision_file

def load_env():
    # kolibri can only create one level sub-directory for KOLIBRI_HOME.
    # So, create KOLIBRI_HOME path here.
    create_dir(KOLIBRI_HOME)

    # The %APPDATA% is a mapped virtual path for APPX/MSIX package on Windows.
    # However, the cookies' storage path created by Windows' native webview
    # invoked by pywebview is not the mapped virtual path.
    # https://docs.python.org/3.11/using/windows.html#redirection-of-local-data-registry-and-temporary-paths
    set_real_kolibri_home()

    os.environ['KOLIBRI_HOME'] = KOLIBRI_HOME
    os.environ['DJANGO_SETTINGS_MODULE'] = "kolibri_tools.endless_key_settings"
    os.environ['PYTHONPATH'] = KOLIBRI_EXTENSIONS
    os.environ['KOLIBRI_APPS_BUNDLE_PATH'] = os.path.join(EKAPP_DIR, 'apps-bundle', 'apps')
    os.environ['KOLIBRI_CONTENT_COLLECTIONS_PATH'] = os.path.join(EKAPP_DIR, 'collections')
    os.environ["KOLIBRI_LISTEN_ADDRESS"] = KOLIBRI_IP
    os.environ["KOLIBRI_HTTP_PORT"] = str(KOLIBRI_PORT)

    # Loading kolibri env, using as Windows APPX/MSIX application
    os.environ["KOLIBRI_PROJECT"] = METRICS_ID

    setup_provision()


if __name__ == "__main__":
    load_env()
    freeze_support()
    set_log()

    # Monkey patch subprocess.Popen to hide the console on endless-key
    # subcommands
    import subprocess
    orig = subprocess.Popen
    def override(*args, **kwargs):
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        orig(*args, startupinfo=startupinfo, **kwargs)
    subprocess.Popen = override

    app = Application()
    app.run()
