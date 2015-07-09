'use strict';
import sinon from 'sinon';
import EventPipeline from '@hoist/events-pipeline';
import Server from '../../../../lib/server';
import {
  _mongoose,
  Event,
  Application,
  Organisation
}
from '@hoist/model';
import config from 'config';
import {
  expect
}
from 'chai';

describe('POST /event/{eventName}', function () {
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
      .then((results) => {
        application = results[0];
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
  describe('with matching eventName', function () {
    var _response;
    var payload = {
      key: 'value'
    };
    before(function (done) {
      sinon.stub(EventPipeline.prototype, 'raise', function (context, eventName) {
        return Promise.resolve(new Event({
          eventId: 'eventid',
          applicationId: context.application._id,
          environment: context.environment,
          eventName: eventName,
          payload: payload
        }));
      });
      server._hapiServer.inject({
        method: 'POST',
        url: '/event/eventName',
        headers: {
          authorization: 'Hoist apiKey',
          'content-type': 'application/json'
        },
        payload: JSON.stringify(payload)
      }, function (response) {
        _response = response;
        done();
      });
    });
    after(function () {
      EventPipeline.prototype.raise.restore();
    });
    it('raises the event', function () {
      expect(EventPipeline.prototype.raise).to.have.been.calledWith({
        application: application.toObject(),
        environment: 'live'
      }, 'eventName', payload);
    });
    it('returns the event', function () {
      expect(_response.result.payload).to.eql(payload);
      expect(_response.result.eventName).to.eql('eventName');
    });
    it('responds with 201 CREATED', function () {
      expect(_response.statusCode).to.eql(201);
    });
  });
  describe('with pipeline.raise failing', function () {
    var _response;
    var payload = {
      key: 'value'
    };
    before(function (done) {
      sinon.stub(EventPipeline.prototype, 'raise').returns(Promise.reject());
      server._hapiServer.inject({
        method: 'POST',
        url: '/event/eventName',
        headers: {
          authorization: 'Hoist apiKey',
          'content-type': 'application/json'
        },
        payload: JSON.stringify(payload)
      }, function (response) {
        response.payload = JSON.parse(response.payload);
        _response = response;
        done();
      });
    });
    after(function () {
      EventPipeline.prototype.raise.restore();
    });
    it('responds with a 500', function () {
      expect(_response.statusCode).to.eql(500);
    });
  });
});
