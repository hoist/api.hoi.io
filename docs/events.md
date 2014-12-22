#Group Events
All API's related to Events within Hoist.

#Event Stream [/events?streamId={streamId}]
A streaming API to get all events as they fire


  + Model (application/json)

    + Body

      {
        streamId:{streamId},
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

Retrieves a stream of events and sets up a stream id. Stream id’s will stay available for 10 minutes since the last request. This is a long polling API and should be used with ?streamId to stream results

   + Parameters

     + streamId (optional, string) ... the id of the stream to continue
     + filterField (optional, 'eventName' or 'correlationId') ... the field to filter the stream by
     + filterValue (optional, string) ... the value to filter the stream by
     + timeoutMs (optional, number) ... the number of ms to timeout when no events are available (will return an empty array) defaults to 10000

   + Request
       + Headers
           Content-Type: application/json
           Authorization: Hoist {authKey}
           X-Hoist-Filter-By: {filterField}
           X-Hoist-Filter-Value: {filterValue}
           X-Hoist-Connection-Timeout: {timeoutMs}

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
  + Parameters

    + id (string) ... Id of the event to return

  + Response 200

    [Event][]


## Add an event [POST]

create a new event
  + Parameters

    + id (optional, string) ... the id of the event to create

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
