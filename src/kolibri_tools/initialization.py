import logging
import os
import sys

import pew.ui


def setup_env():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.abspath(os.path.join(script_dir, '..'))
    logging.info("service script root_dir = {}".format(root_dir))

    sys.path.append(root_dir)
    sys.path.append(os.path.join(root_dir, "kolibri", "dist"))

    os.environ["DJANGO_SETTINGS_MODULE"] = "kolibri_tools.django_app_settings"
