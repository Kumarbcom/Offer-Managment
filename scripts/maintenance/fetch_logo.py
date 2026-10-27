import urllib.request, base64
html = urllib.request.urlopen('https://siddhikabel.com/images/favicon.png').read()
print('export const DEFAULT_LOGO_BASE64 = \\'data:image/png;base64,' + base64.b64encode(html).decode('utf-8') + '\\';')
