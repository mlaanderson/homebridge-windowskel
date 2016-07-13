# homebridge-windowskel
Skeleton Homebridge Window Plugin

## Description
homebrideg-windowskel is a skeleton window plugin for
[Homebridge](https://github.com/nfarina/homebridge). It
does not actually do anything but create a fake window
service on the Homebridge server. Its primary purpose is to
be used in the development of real window services.

## Usage
```
{
    "bridge": {
        "name": "My House",
        "username": "CC:22:3D:E3:CE:30",
        "port": 51826,
        "pin": "031-45-154"
    },

    "description": "My Homebridge Server",

    "accessories": [
        ...,
        {
            "accessory": "WindowSkel",
            "name": "Window",
            "description": "Skeleton Window"
        }
    ],

    "platforms": [
    ]
}
```
