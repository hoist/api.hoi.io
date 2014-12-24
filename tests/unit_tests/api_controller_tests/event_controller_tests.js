'use strict';
require('../../bootstrap');
var Server = require('../../../lib/server');
var expect = require('chai').expect;
var Model = require('hoist-model');
var BBPromise = require('bluebird');
var mongoose = BBPromise.promisifyAll(Model._mongoose);
var config = require('config');
var sinon = require('sinon');


describe('Event Routes', function () {

  var server;
  before(function () {
    server = Server.createServer();
    return BBPromise.all([
      mongoose.connectAsync(config.get('Hoist.mongo.db')),
      new Model.Organisation({
        _id: 'orgid',
        name: 'test org',
        slug: 'org'
      }).saveAsync(),
      new Model.Application({
        _id: 'appid',
        organisation: 'orgid',
        name: 'test app',
        apiKey: 'apiKey',
        slug: 'app'
      }).saveAsync()
    ]);
  });
  after(function () {
    return BBPromise.all([
      Model.Organisation.removeAsync(),
      Model.Application.removeAsync()
    ]).then(function () {
      return mongoose.disconnectAsync();
    });
  });
  describe('GET /event/{id}', function () {
    describe('with matching event', function () {
      var _response;
      var _event;
      var clock;
      before(function (done) {
        clock = sinon.useFakeTimers();
        new Model.Event({
            eventId: 'eventid',
            applicationId: 'appid',
            environment: 'live'

          }).saveAsync()
          .then(function (event) {
            _event = event;
            server.inject({
              method: 'GET',
              url: '/event/eventid',
              headers: {
                authorization: 'Hoist apiKey'
              }
            }, function (response) {
              _response = response;
              done();
            });
          });
      });
      after(function () {
        clock.restore();
        return Model.Event.removeAsync();
      });
      it('returns the event JSON', function () {
        expect(JSON.parse(_response.payload)).to.eql(JSON.parse(JSON.stringify(_event.toObject())));
      });
      it('responds with 200 OK', function () {
        expect(_response.statusCode).to.eql(200);
      });
    });
    describe('with no matching event', function () {

      var _response;
      before(function (done) {

        server.inject({
          method: 'GET',
          url: '/event/eventid',
          headers: {
            authorization: 'Hoist apiKey'
          }
        }, function (response) {
          _response = response;
          done();

        });
      });
      after(function () {
        return Model.Event.removeAsync();
      });
      it('responds with a 404 NOT FOUND', function () {
        expect(_response.statusCode).to.eql(404);
      });
      it('responds with descriptive message', function () {
        expect(JSON.parse(_response.payload)).to.eql({
          statusCode: 404,
          error: 'Not Found',
          message: 'event not found'
        });
      });
    });
  });
  describe('POST /event/{eventName}', function () {
    describe('with matching eventName', function () {
      it('raises the event');
      it('copies body to payload');
      it('responds with 201 CREATED');
    });
  });
  describe('GET /events', function () {
    describe('with no existing stream', function () {
      it('creates a new stream');
      it('returns the stream token');
      it('returns after timeout');
      it('responds with 201 CREATED');
    });
    describe('with an existing stream', function () {
      it('returns events stored in the stream');
      it('resets stream timeout');
      it('responds with 200 OK');
    });
    describe('with an existing stream more than 10 minutes old', function () {
      it('creates a new stream');
      it('responds with 201 CREATED');
    });

  });
});
