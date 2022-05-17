from kolibri.deployment.default.settings.base import *


MIDDLEWARE = list(MIDDLEWARE) + [  # noqa F405
    "kolibri_tools.middleware.AlwaysAuthenticatedMiddleware"
]
