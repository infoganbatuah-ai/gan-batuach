# Real Camera Connection User Guide

This guide explains how a manager or admin connects real cameras without exposing camera secrets in the browser.

## Before You Start

You need:

- Camera system type.
- Camera or DVR/NVR address.
- Port, usually `554` for RTSP.
- Username and password.
- Channel number when using DVR/NVR.
- Active Video Gateway for live preview.

If the gateway is not active, the system can save and test readiness, but live viewing will show:

`המערכת מוכנה לחיבור, אך נדרש Video Gateway פעיל כדי להציג שידור חי.`

## DVR / NVR Flow

DVR/NVR is a central recorder box connected to multiple cameras.

Ask the installer or check the recorder screen for:

- Brand: Hikvision, Dahua, Uniview, Axis, or Generic.
- DVR/NVR IP address or domain.
- RTSP port.
- Username.
- Password.
- Channel number.
- Stream quality.

Channel number means the camera slot inside the recorder. For example, camera 1 is usually channel `1`.

## IP Camera Flow

An IP camera is a standalone network camera.

You need:

- Camera IP/domain.
- Port.
- Username.
- Password.
- Whether the camera supports RTSP, ONVIF, or both.

You can usually find the IP address in the router, camera app, or installer notes.

## Manual RTSP Flow

Use this when a technician gives you a full RTSP URL.

You enter:

- Full RTSP URL.
- Username/password if they are separate.

The full RTSP URL is sent to the server for validation and is not returned to the browser after saving.

## ONVIF Flow

ONVIF is a camera discovery and control standard.

Use it when:

- You know the camera supports ONVIF.
- You want the gateway to discover stream details.
- You do not know the exact RTSP path yet.

ONVIF still needs a Video Gateway for live preview.

## Home Test Camera Flow

Use this for Daniel’s private test camera or another non-production test site.

Rules:

- The camera must support RTSP or ONVIF.
- The camera is marked as `home_test`.
- It is not production kindergarten data.
- It should be used only to validate gateway readiness and connection behavior.

## Why Video Gateway Is Needed

Browsers should not connect directly to RTSP cameras.

The gateway:

- Connects to RTSP/ONVIF server-side.
- Converts video to HLS or WebRTC.
- Keeps camera credentials private.
- Issues playback through short-lived tokens.
- Allows audit logs for viewing and setup.

## Security Rules

- Do not show RTSP URLs after saving.
- Do not show camera passwords after saving.
- Do not expose gateway keys in client code.
- Parent viewing must use permission checks.
- Manager/admin viewing must use permission checks.
- Every setup/test/playback action should be audited.
