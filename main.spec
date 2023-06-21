# -*- mode: python ; coding: utf-8 -*-


block_cipher = None


a = Analysis(
    ['src\\main.pyw'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=[
                 'pkg_resources',
                 'uuid',
                 'pkg_resources.py2_warn',
                 'logging.handlers',
                 'logging.config',
                 'decimal',
                 'html.parser',
                 'cgi',
                 'pickletools',
                 'dataclasses',
                 'email.mime',
                 'email.mime.base',
                 'email.mime.message',
                 'email.mime.multipart',
                 'email.mime.text',
                 'ctypes.wintypes',
                 'http.cookies',
                 'sqlite3',
                 'concurrent',
                 'concurrent.futures',
                 'configparser',
                 'csv',
                 'xml.dom',
                 'wsgiref',
                 'wsgiref.headers',
                 'wsgiref.util',
                 'wsgiref.simple_server',
                 'xml.etree',
                 'xml.etree.ElementTree',
                 'distutils.version',
                 '_pyio',
                 'kolibri_tools.endless_key_settings',
                 'kolibri_tools.middleware',
    ],
    excludes=['kolibri'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='Kolibri',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='Kolibri',
)
