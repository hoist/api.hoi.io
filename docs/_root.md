FORMAT: 1A
HOST: https://api.hoi.io

# Hoist HTTP API

## URL Root

All urls have the root of https://api.hoi.io

## Authentication
Hoist uses a token based authentication. All calls should be made with an Authorization header set to Hoist <apiKey> where API Key can be found in the Hoist portal at https://portal.hoist.io

![screenshot here](/screenshot.jpg)

```http
Authorization: Hoist 23193slakdoqw3213
```

## Response codes and errors
Hoist uses standard REST style response codes and you should look up any response code in this table

On errors the body of the request will contain a JSON error

```javascript
{
    "code":404,
    "message":"a more descriptive message of what went wrong"
}
```

|Response Code | Meaning|
|--------------|--------|
|200 `OK`          | Self evident|
|201 `Created`          | As `200 OK` but something was created in the call |
|404 `Not Found`          | The endpoint or expected object cannot be found|
|500-599 `Unexpected Server Error` | Something we didn't anticipate has happened, if you get this you should email us at support@hoist.io |
