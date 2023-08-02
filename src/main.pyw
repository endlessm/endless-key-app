#!/bin/env python3

import logging
import os
from shutil import copyfile
import time
import webview

from threading import Thread

NULL_PLUGIN_VERSION = '0'
KOLIBRI = 'http://localhost:5000'

EKAPP_DIR = os.path.dirname(os.path.realpath(__file__))
KOLIBRI_EXTENSIONS = os.path.join(EKAPP_DIR, 'kolibri/dist')
KOLIBRI_HOME = os.path.expandvars('%APPDATA%/endless-key')
METRICS_ID = 'endless-key-windows'
AUTOPROVISION_FILE = os.path.join(EKAPP_DIR, 'automatic_provision.json')

window = None

class Api:
    def load(self, useUsb, packId):
        os.environ['KOLIBRI_INITIAL_CONTENT_PACK'] = packId

        logging.info('triggered by preload_js')
        launch_kolibri()

def start_kolibri():
    from run_kolibri import Application

    kolibri_app = Application()
    window.events.closed += kolibri_app.stop
    kolibri_app.run()

def when_kolibri_up(url):
    print(f'Change to {url}')
    window.load_url(url)

def wait_for_kolibri_up():
    time.sleep(10)
    when_kolibri_up(f'{KOLIBRI}/explore')

def launch_kolibri():
    kolibri_t = Thread(target=start_kolibri)
    kolibri_t.daemon = True
    kolibri_t.start()

    wait_t = Thread(target=wait_for_kolibri_up)
    wait_t.daemon = True
    wait_t.start()

def preload_js():
    js = """
    console.log('loaded js')
    window.WelcomeWrapper = {
        startWithNetwork: (packId) => {
            console.log("choose: " + packId)
            pywebview.api.load(false, packId)
        },
    }
    """

    window.evaluate_js(js)

def setup_provision():
    provision_file = os.path.join(EKAPP_DIR, 'provision.json')

    if (not os.path.exists(provision_file)):
        try:
            copyfile(AUTOPROVISION_FILE, provision_file)
        except:
            provision_file = AUTOPROVISION_FILE

    os.environ['KOLIBRI_AUTOMATIC_PROVISION_FILE'] = provision_file

def load_env():
    os.environ['KOLIBRI_HOME'] = KOLIBRI_HOME
    os.environ['DJANGO_SETTINGS_MODULE'] = 'kolibri_tools.endless_key_settings'
    os.environ['PYTHONPATH'] = KOLIBRI_EXTENSIONS
    os.environ['KOLIBRI_APPS_BUNDLE_PATH'] = os.path.join(EKAPP_DIR, 'apps-bundle/apps')
    os.environ['KOLIBRI_CONTENT_COLLECTIONS_PATH'] = os.path.join(EKAPP_DIR, 'collections')

    setup_provision()

def open_handler():
    #window.toggle_fullscreen()
    if (not os.path.isdir(KOLIBRI_HOME)):
        window.evaluate_js('WelcomeApp.showWelcome()')
        preload_js()
    else:
        launch_kolibri()

if __name__ == '__main__':
    load_env()
    api = Api()
    window = webview.create_window(
            'Endless Key',
            'kolibri/dist/kolibri_explore_plugin/welcomeScreen/index.html',
            js_api=api)
    webview.start(open_handler, debug=True)