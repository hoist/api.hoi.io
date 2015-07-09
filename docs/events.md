#Group Events
All API's related to Events within Hoist.

#Event Stream [/events?token={token}&filterBy={filterBy}&filterValue={filterValue}&timeoutMs={timeoutMs}]

A streaming API to get all events as they fire


+ Model (application/json; charset=utf-8)

    + Body

            {
                "token":"{token}",
                "events":[
                {
                    "eventId":"1"
                },
                {
                    "eventId":"2"
                }]
            }


## Retrieve Event Stream [GET]

Retrieves a stream of events and sets up a stream token.

* Initial requests can leave off the token and one will be generated for you.
\

* Subsequent requests with the token will return events since the token was created, a new token will be generated to continue the stream for future requests.

* The token value will remain valid for 10 minutes after the token is created.

eg.

```http
GET /events
Host: https://api.hoi.io
Content-Type: application/json

{
    "token":"abcdefg1234"
    "events":[{
        "eventName":"my-event"
    }]
}
```
then
```http
GET /events?token=abcdefg1234
Host: https://api.hoi.io
Content-Type: application/json

{
    "token":"<newToken>",
    "events":[{
        ... any events since last poll using the id
        }]
}
```

+ Parameters

    + token (optional, string, `abc123`) ... the token returned in the last request to continue where it left off
    + filterBy (optional, 'eventName' or 'correlationId', `eventName`) ... the field to filter the stream by
    + filterValue (optional, string, `eventid`) ... the value to filter the stream by
    + timeoutMs (optional, number, `20000`) ... the number of ms to timeout when no events are available (will return an empty array) defaults to 10000

+ Request
    + Headers

            Content-Type: application/json
            Authorization: Hoist {authKey}

+ Response 201
    [Event Stream][]


#Create an event [/event/{eventName}]

+ Model (application/json; charset=utf-8)

    + Body

            {
                "eventId":"{id}",
                "eventName":"my:event",
                "correlationId":"correlationid",
                "createdAt":"2014-12-22T03:58:00.760Z",
                "payload":{
                    "key":"value"
                }
            }


## Add an event [POST]

Create a new event with the name specified in url, the * request body * will be used as the payload

+ Parameters

    + eventName (string, `my:event`) ... the type of event to create, ensure this is url encoded

+ Request

    + Headers

            Content-Type: application/json
            Authorization: Hoist {authKey}

    + Body
      ```
      {
          "key":"value"
      }
      ```

+ Response 201
    [Create an event][]
