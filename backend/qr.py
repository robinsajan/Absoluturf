import qrcode

data = "https://docs.google.com/forms/d/e/1FAIpQLSec5sHeiZRwPLNnyUspVVFBXIKK8RjFJaLQynS7FE6cVLqW4w/viewform?usp=publish-editor"

qr = qrcode.make(data)
qr.save("instagram.png")