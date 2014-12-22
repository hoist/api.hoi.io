FORMAT: 1A
HOST: https://api.hoist.io

# Hoist HTTP API

## URL Root

All urls have the root of https://api.hoi.io

## Authentication
Hoist uses a token based authentication. All calls should be made with an Authorization header set to Hoist <apiKey> where API Key can be found in the Hoist portal at https://portal.hoist.io

![screenshot here](/screenshot.jpg)

```http
Authorization: Hoist 23193slakdoqw3213
```

## Response Codes
Hoist uses standard REST style response codes and you should look up any response code in this table

|Response Code | Meaning|
|--------------|--------|
|200 `OK`          | Self evident|
|201 `Created`          | As `200 OK` but something was created in the call |
|404 `Not Found`          | The endpoint or expected object cannot be found|
