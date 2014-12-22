#Group Events
All API's related to Events within Hoist.

#Event Stream [/events?token={token}&filterBy={filterBy}&filterValue={filterValue}&timeoutMs={timeoutMs}]

A streaming API to get all events as they fire


+ Model (application/json)

    + Body

            {
                token:{token},
                events:[
                {
                    "eventId":"1"
                    ...
                },
                {
                    "eventId":"2"
                    ...
                }]
            }


## Retrieve Event Stream [GET]

Retrieves a stream of events and sets up a stream token.
* Subsequent requests with the same token will return events since the last poll using that token, so it can be used to create a full stream.

* Initial requests can leave off the token and one will be generated for you.

* The token value will remain valid for 10 minutes after the last poll using the token.

eg.

```http
GET /events
Host: https://api.hoi.io
Content-Type: application/json

{
    token:'abcdefg1234'
    events:[{
        eventName:'my-event'
    }]
}
```
then
```http
GET /events?token=abcdefg1234
Host: https://api.hoi.io
Content-Type: application/json

{
    token:'abcdefg1234',
    events:[{
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

+ Response 200
    [Event Stream][]

#Event [/event/{id}]

+ Model (application/json)

    + Body

            {
                "eventId":"{id}",
                "eventName":"eventName",
                "correlationId":"correaltionId",
                "createdAt":"2014-12-22T03:58:00.760Z"
            }

## Retrieve a single Event [GET]

Get the event with the specified id

+ Parameters

    + id (string, `eventid`) ... Id of the event to return

+ Request

    + Headers

              Content-Type: application/json
              Authorization: Hoist {authKey}

+ Response 200

    [Event][]


## Add an event [POST]

Create a new event with the name specified in the body

+ Parameters

    + id (optional, string, `eventid`) ... the id of the event to create

+ Request

    + Headers

            Content-Type: application/json
            Authorization: Hoist {authKey}

    + Body
      ```
      {
        "eventName":"{eventName}"
      }
      ```

+ Response 201
    [Event][]
