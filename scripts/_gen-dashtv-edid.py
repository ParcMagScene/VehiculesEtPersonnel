#!/usr/bin/env python3
# EDID minimal 1920x1080@60 (CEA-861, 148.5 MHz) pour kiosk DashTV.
# Utilisé via drm.edid_firmware=HDMI-A-1:edid/dashtv-1080p.bin
import struct
import sys

edid = bytearray(128)
edid[0:8] = b"\x00\xff\xff\xff\xff\xff\xff\x00"
edid[8:10] = struct.pack(">H", (12 << 10) | (14 << 5) | 24)
edid[10:12] = struct.pack("<H", 1)
edid[12:16] = struct.pack("<I", 0)
edid[16] = 1
edid[17] = 2026 - 1990
edid[18] = 1
edid[19] = 3
edid[20] = 0x80
edid[21] = 160
edid[22] = 90
edid[23] = 0x78
edid[24] = 0x0A
edid[25:35] = bytes.fromhex("ee95a3544c99260f5054")
edid[35:38] = b"\x00\x00\x00"
for i in range(38, 54, 2):
    edid[i:i+2] = b"\x01\x01"

# DTD 1 = 1920x1080@60 preferred
edid[54:72] = bytes([
    0x02, 0x3A,
    0x80, 0x18, 0x71,
    0x38, 0x2D, 0x40,
    0x58, 0x2C, 0x45, 0x00,
    0x40, 0x84, 0x63,
    0x00, 0x00,
    0x1E,
])

edid[72:90] = b"\x00\x00\x00\xfc\x00" + b"DashTV 1080p\n"
edid[90:108] = (
    b"\x00\x00\x00\xfd\x00"
    + bytes([50, 70, 30, 70, 20, 0])
    + b"\x0a\x20\x20\x20\x20\x20\x20"
)
edid[108:126] = b"\x00\x00\x00\xfe\x00" + b"DashTV kiosk\n"
edid[126] = 0
edid[127] = (256 - (sum(edid[:127]) % 256)) % 256

sys.stdout.buffer.write(bytes(edid))
