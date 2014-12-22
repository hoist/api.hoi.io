#Group Events
All API's related to Events within Hoist.

#Event Stream [/events]

  + Model (application/json)

    + Body

        [{
          "eventId":"1"
          ...
        },
        {
          "eventId":"2"
          ...
        }]


## Retrieve Event Stream [GET]

   + Parameters

     + filter-field (optional, string, 'eventName') ... the field to filter the stream by

     + filter-value (optional, string, 'my-event') ... the value to filter the stream by

   + Request
       + Headers
           "Content-Type": "application/json"
           "Authorization": Hoist {auth-key}
           "X-Hoist-Filter-By": {filter-field}
           "X-Hoist-Filter-Value": {filter-value}

   + Response 200
       [Event Stream][]

#Event [/event/{id}]

+ Parameters

  + id (string, 1) ... Id of the event to return

+ Model (application/json)

  + Body

    {
      "eventId":"{id}",
      "eventName":"eventName",
      "correlationId":"correaltionId"
    }

## Retrieve a single Event [GET]
  + Response 200
  [Event][]


## Add an event [POST]

create a new event
  + Parameters

    + id (optional, string, 1) ... the id of the event to create

  + Request

    + Headers

      Content-Type: "application/json"
      Authorization: Hoist {auth-key}

    + Body
      ```
      {
        "eventName":"{eventName}"
      }
      ```

  + Response 201

    [Event][]
