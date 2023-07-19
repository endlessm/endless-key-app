#!/bin/env python3

import os
from shutil import copyfile
import time
import webview

from threading import Thread

from run_kolibri import Application

NULL_PLUGIN_VERSION = '0'
KOLIBRI = 'http://localhost:5000'

EKAPP_DIR = os.path.dirname(os.path.realpath(__file__))
KOLIBRI_EXTENSIONS = os.path.join(EKAPP_DIR, 'kolibri/dist')
KOLIBRI_HOME = os.path.expandvars('%APPDATA%/endless-key')
METRICS_ID = 'endless-key-windows'
AUTOPROVISION_FILE = os.path.join(EKAPP_DIR, 'automatic_provision.json')

class Api:
    def __init__(self):
        self.window = None

    def set_window(self, window):
        self.window = window

    def load(self, useUsb, packId):
        print(f"useUsb={useUsb}, choose {packId}")
        os.environ['KOLIBRI_INITIAL_CONTENT_PACK'] = packId
        start_kolibri(window)

def setup_provision():
    provision_file = os.path.join(EKAPP_DIR, 'provision.json')

    if (not os.path.exists(provision_file)):
        try:
            copyfile(AUTOPROVISION_FILE, provision_file)
        except:
            provision_file = AUTOPROVISION_FILE

    os.environ['KOLIBRI_AUTOMATIC_PROVISION_FILE'] = provision_file

def wait_for_kolibri_up(window):
    time.sleep(20)

    window.load_url(f'{KOLIBRI}/explore')

def start_kolibri(window):
    os.environ['KOLIBRI_HOME'] = KOLIBRI_HOME
    os.environ['DJANGO_SETTINGS_MODULE'] = 'kolibri_tools.endless_key_settings'
    os.environ['PYTHONPATH'] = KOLIBRI_EXTENSIONS
    os.environ['KOLIBRI_APPS_BUNDLE_PATH'] = os.path.join(EKAPP_DIR, 'apps-bundle/apps')
    os.environ['KOLIBRI_CONTENT_COLLECTIONS_PATH'] = os.path.join(EKAPP_DIR, 'collections')

    setup_provision()

    kolibri_app = Application()
    t = Thread(target=kolibri_app.run)
    t.daemon = True
    t.start()

    wait_for_kolibri_up(window)

def preload_js(window):
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

def open_handler(window):
    #window.toggle_fullscreen()
    if (not os.path.isdir(KOLIBRI_HOME)):
        window.evaluate_js('WelcomeApp.showWelcome()')
        preload_js(window)
    else:
        start_kolibri(window)

if __name__ == '__main__':
    api = Api()
    window = webview.create_window(
            'Endless Key',
            'kolibri/dist/kolibri_explore_plugin/welcomeScreen/index.html',
            js_api=api)
    webview.start(open_handler, window, debug=False)
