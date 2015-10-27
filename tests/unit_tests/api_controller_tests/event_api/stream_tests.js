'use strict';
import Server from '../../../../lib/server';
import {
  _mongoose,
  Application,
  Organisation,
  EventToken
}
from '@hoist/model';
import config from 'config';
import request from 'request-promise';
import {
  expect
}
from 'chai';

let baseRabbitManagementUri = `${config.get('Hoist.rabbit.managementurl')}api/`;
describe('GET /events', function () {
  let server;
  let application;
  before(() => {
    server = new Server();
    server._createServer();
    return Promise.all([
      _mongoose.connectAsync(config.get('Hoist.mongo.core.connectionString')),
      new Organisation({
        _id: 'orgid',
        name: 'test org',
        slug: 'org'
      }).saveAsync(),
      new Application({
        _id: 'appid2',
        organisation: 'orgid',
        name: 'test app',
        apiKey: 'apiKey',
        slug: 'app'
      }).saveAsync()
      .then((a) => {
        application = a;
      })
    ]);
  });
  after(function () {
    return Promise.all([
      Organisation.removeAsync(),
      Application.removeAsync()
    ]).then(function () {
      return _mongoose.disconnectAsync();
    });
  });
  describe('on initial call', function () {
    this.timeout(5000);
    let _response;
    let queueDetails;
    let exchangeUri = `${baseRabbitManagementUri}exchanges/${encodeURIComponent('/')}/hoist`;
    let queueUri;
    before((done) => {
      //clock = sinon.useFakeTimers();
      server._hapiServer.inject({
        method: 'GET',
        url: '/events?timeoutMS=10',
        headers: {
          authorization: 'Hoist apiKey',
          'content-type': 'application/json'
        }
      }, (response) => {
        _response = response;
        queueUri = `${baseRabbitManagementUri}queues/${encodeURIComponent('/')}/${encodeURIComponent(_response.result.token)}_stream`;
        request({
          method: 'GET',
          uri: queueUri,
          json: true
        }).then((queueResponse) => {
          queueDetails = queueResponse;
          done();
        }).catch((err) => {
          done(err);
        });
      });
    });
    after(() => {
      return Promise.all([
        request({
          method: 'DELETE',
          uri: exchangeUri,
          json: true
        }),
        request({
          method: 'DELETE',
          uri: queueUri,
          json: true
        }),
        EventToken.removeAsync({})
      ]);
    });
    it('returns new token code', () => {
      return expect(_response.result.token).to.exist;
    });
    it('responds with 200|OK', () => {
      return expect(_response.statusCode).to.eql(200);
    });
    it('links the token to a rabbit queue', () => {
      return expect(queueDetails).to.exist;
    });
    it('saves a token to the db', () => {
      return EventToken.findOneAsync({
        code: _response.result.token
      }).then((eventToken) => {
        return expect(eventToken.application).to.eql(application._id) &&
          expect(eventToken.environment).to.eql('live');
      });
    });
    it('links the queue to the correct event exchange', () => {
      return request({
        method: 'GET',
        uri: `${exchangeUri}/bindings/source`,
        json: true
      }).then((boundQueues) => {
        return expect(boundQueues.length).to.eql(1) &&
          expect(boundQueues[0].destination).to.eql(`${_response.result.token}_stream`) &&
          expect(boundQueues[0].routing_key).to.eql(`event.${application._id}.*.*`);
      });
    });
    it('sets expiry on the queue', () => {
      return expect(queueDetails.arguments['x-expires']).to.eql(3600000);
    });
  });
  describe('on call with a token', function () {
    this.timeout(10000);
    let eventToken;
    let queueUri;
    let event1 = {
      name: 'event1'
    };
    let event2 = {
      name: 'event2'
    };
    let _response;
    before((done) => {
      eventToken = new EventToken({
        application: application._id,
        environment: 'live'
      });

      return eventToken.saveAsync()
        .then(() => {
          queueUri = `${baseRabbitManagementUri}queues/${encodeURIComponent('/')}/${encodeURIComponent(eventToken.code)}_stream`;
          console.log(queueUri);
          return request({
            method: 'PUT',
            uri: queueUri,
            json: true,
            body: {
              "auto_delete": false,
              "durable": true,
              "arguments": {
                'x-expires': 10000
              }
            }
          }).catch((err) => {
            console.log(err);
          });
        }).then(() => {
          return Promise.all([
            request({
              method: 'POST',
              uri: `${baseRabbitManagementUri}exchanges/${encodeURIComponent('/')}/amq.default/publish`,
              json: true,
              body: {
                "properties": {},
                "routing_key": `${eventToken.code}_stream`,
                "payload": JSON.stringify(event1),
                "payload_encoding": "string"
              }
            }),
            request({
              method: 'POST',
              uri: `${baseRabbitManagementUri}exchanges/${encodeURIComponent('/')}/amq.default/publish`,
              json: true,
              body: {
                "properties": {},
                "routing_key": `${eventToken.code}_stream`,
                "payload": JSON.stringify(event2),
                "payload_encoding": "string"
              }
            })
          ]);
        }).then(() => {
          server._hapiServer.inject({
            method: 'GET',
            url: `/events?token=${encodeURIComponent(eventToken.code)}`,
            headers: {
              authorization: 'Hoist apiKey',
              'content-type': 'application/json'
            }
          }, (response) => {
            _response = response;
            done();
          });
        });

    });
    after(() => {
      return Promise.all([
        request({
          method: 'DELETE',
          uri: queueUri,
          json: true
        }),
        EventToken.removeAsync({})
      ]);
    });
    it('polls for any messages in the queue', () => {
      return expect(_response.result.events.length).to.eql(2);
    });
    it('returns the token', () => {
      return expect(_response.result.token).to.eql(eventToken.code);
    });
    it('removes messages from the queue', () => {
      return request({
        method: 'GET',
        uri: queueUri,
        json: true
      }).then((result) => {
        return expect(result.messages).to.eql(0);
      });
    });
  });
  describe('on call with expired token', () => {
    this.timeout(10000);
    let eventToken;
    let queueUri;
    let _response;
    before((done) => {

      eventToken = new EventToken({
        application: application._id,
        environment: 'live'
      });

      return eventToken.saveAsync()
        .then(() => {
          server._hapiServer.inject({
            method: 'GET',
            url: `/events?token=${encodeURIComponent(eventToken.code)}&timeoutMS=50`,
            headers: {
              authorization: 'Hoist apiKey',
              'content-type': 'application/json'
            }
          }, (response) => {
            _response = response;
            queueUri = `${baseRabbitManagementUri}queues/${encodeURIComponent('/')}/${encodeURIComponent(_response.result.token)}_stream`;
            done();
          });
        });
    });
    after(() => {
      return Promise.all([
        request({
          method: 'DELETE',
          uri: queueUri,
          json: true
        }),
        request({
          method: 'DELETE',
          uri: `${baseRabbitManagementUri}exchanges/${encodeURIComponent('/')}/hoist`,
          json: true
        }),
        EventToken.removeAsync({})
      ]);
    });
    it('sets up a new queue', () => {
      return request({
        method: 'GET',
        uri: queueUri,
        json: true
      }).then((response) => {
        return expect(response.name).to.exist;
      });
    });
    it('returns a token', () => {
      return expect(_response.result.token).to.exist && expect(_response.result.token).to.not.eql(eventToken.code);
    });
  });
});
