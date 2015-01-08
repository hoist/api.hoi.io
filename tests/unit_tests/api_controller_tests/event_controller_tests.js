'use strict';
require('../../bootstrap');
var Server = require('../../../lib/server');
var expect = require('chai').expect;
var Model = require('hoist-model');
var BBPromise = require('bluebird');
var mongoose = BBPromise.promisifyAll(Model._mongoose);
var config = require('config');
var sinon = require('sinon');
var pipeline = require('hoist-events-pipeline').Pipeline;
var _ = require('lodash');

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
      var _response;
      var _event;
      var payload = {
        key: 'value'
      };
      before(function (done) {
        sinon.stub(pipeline.prototype, 'raise', function (eventName, payload) {
          return BBPromise.resolve(new Model.Event({
            eventId: 'eventid',
            applicationId: 'appid',
            environment: 'live',
            eventName: eventName,
            payload: payload
          }));
        });
        server.inject({
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
          done()
        });
      });
      after(function () {
        pipeline.prototype.raise.restore();
      });
      it('raises the event', function () {
        expect(pipeline.prototype.raise).to.have.been.calledWith('eventName', payload);
      });
      it('returns the event', function () {
        expect(_response.payload.payload).to.eql(payload);
        expect(_response.payload.eventName).to.eql('eventName');
      });
      it('responds with 201 CREATED', function () {
        expect(_response.statusCode).to.eql(201);
      });
    });
    describe('with pipeline.raise failing', function () {
      var _response;
      var _event;
      var payload = {
        key: 'value'
      };
      before(function (done) {
        sinon.stub(pipeline.prototype, 'raise').returns(BBPromise.reject());
        server.inject({
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
          done()
        });
      });
      after(function () {
        pipeline.prototype.raise.restore();
      });
      it('responds with a 500', function () {
        expect(_response.statusCode).to.eql(500);
      });
    });
  });
  describe('GET /events', function () {
    this.timeout(20000);
    describe('with no token', function () {
      describe('with events in timeout', function () {
        var _token;
        var _response;
        var _event;
        before(function (done) {
          setTimeout(function () {
            new Model.Event({
              applicationId: 'appid',
              environment: 'live'
            }).saveAsync().then(function (event) {
              _event = event;
            });
          }, 1000)
          server.inject({
            method: 'GET',
            url: '/events?&timeoutMS=2000',
            headers: {
              authorization: 'Hoist apiKey'
            }
          }, function (response) {
            response.payload = JSON.parse(response.payload);
            _response = response;
            done();
          });
        });
        after(function () {
          return BBPromise.all([
            Model.EventToken.removeAsync(),
            Model.Event.removeAsync()
          ])
        });
        it('creates a new token', function () {
          return Model.EventToken.findOneAsync()
            .then(function (token) {
              expect(token).to.exist;
            });
        });
        it('returns an event', function () {
          var event = _event.toObject();
          event.createdAt = event.createdAt.toISOString();
          event.updatedAt = event.updatedAt.toISOString();
          expect(_response.payload.events).to.eql([event]);
        });
        it('returns new token code', function () {
          expect(_response.payload.token).to.exist;
        });
        it('responds with 201 CREATED', function () {
          expect(_response.statusCode).to.eql(201);
        });
      });
      describe('with no events in timeout', function () {
        describe('with valid timeoutMS in query', function () {
          var _time;
          var _token;
          var _response;
          before(function (done) {
            _time = Date.now();
            server.inject({
              method: 'GET',
              url: '/events?timeoutMS=2000',
              headers: {
                authorization: 'Hoist apiKey'
              }
            }, function (response) {
              response.payload = JSON.parse(response.payload);
              _response = response;
              done();
            });
          });
          after(function () {
            return Model.EventToken.removeAsync();
          });
          it('creates a new token', function () {
            return Model.EventToken.findOneAsync()
              .then(function (token) {
                expect(token).to.exist;
              });
          });
          it('returns no events', function () {
            expect(_response.payload.events).to.eql([]);
          });
          it('returns new token code', function () {
            expect(_response.payload.token).to.exist;
          });
          it('returns after timeout', function () {
            return Model.EventToken.findOneAsync()
              .then(function (token) {
                expect(token.lastUsed.getTime()).to.be.least(_time + 2000);
              });
          });
          it('responds with 201 CREATED', function () {
            expect(_response.statusCode).to.eql(201);
          });
        });
        describe('with invalid timeoutMS in query', function () {
          var _time;
          var _token;
          var _response;
          before(function (done) {
            _time = Date.now();
            server.inject({
              method: 'GET',
              url: '/events?timeoutMS=20hgsuf00',
              headers: {
                authorization: 'Hoist apiKey'
              }
            }, function (response) {
              response.payload = JSON.parse(response.payload);
              _response = response;
              done();
            });
          });
          after(function () {
            return Model.EventToken.removeAsync();
          });
          it('creates a new token', function () {
            return Model.EventToken.findOneAsync()
              .then(function (token) {
                expect(token).to.exist;
              });
          });
          it('returns no events', function () {
            expect(_response.payload.events).to.eql([]);
          });
          it('returns new token code', function () {
            expect(_response.payload.token).to.exist;
          });
          it('returns after timeout', function () {
            return Model.EventToken.findOneAsync()
              .then(function (token) {
                expect(token.lastUsed.getTime()).to.be.least(_time + 10000);
              });
          });
          it('responds with 201 CREATED', function () {
            expect(_response.statusCode).to.eql(201);
          });
        });
        describe('with no timeoutMS in query', function () {
          var _time;
          var _token;
          var _response;
          before(function (done) {
            _time = Date.now();
            server.inject({
              method: 'GET',
              url: '/events',
              headers: {
                authorization: 'Hoist apiKey'
              }
            }, function (response) {
              response.payload = JSON.parse(response.payload);
              _response = response;
              done();
            });
          });
          after(function () {
            return Model.EventToken.removeAsync();
          });
          it('creates a new token', function () {
            return Model.EventToken.findOneAsync()
              .then(function (token) {
                expect(token).to.exist;
              });
          });
          it('returns no events', function () {
            expect(_response.payload.events).to.eql([]);
          });
          it('returns new token code', function () {
            expect(_response.payload.token).to.exist;
          });
          it('returns after timeout', function () {
            return Model.EventToken.findOneAsync()
              .then(function (token) {
                expect(token.lastUsed.getTime()).to.be.least(_time + 10000);
              });
          });
          it('responds with 201 CREATED', function () {
            expect(_response.statusCode).to.eql(201);
          });
        });
      });
    });
    describe('with an existing token', function () {
      describe('with events since last use', function () {
        describe('without filterBy in query', function () {
          var _token;
          var _response;
          var _events;
          before(function (done) {
            new Model.EventToken({
                application: 'appid',
                environment: 'live',
                code: 'tokenCode',
                lastUsed: Date.now()
              }).saveAsync()
              .then(function (token) {
                _token = token;
                return Model.Event.createAsync([{
                  applicationId: 'appid',
                  environment: 'live',
                  eventId: 'eventid1'
                }, {
                  applicationId: 'appid',
                  environment: 'live',
                  correlationId: 'eventid',
                  eventId: 'eventid2'
                }, {
                  applicationId: 'appid',
                  environment: 'live',
                  eventName: 'eventName',
                  eventId: 'eventid3'
                }])
              }).then(function (events) {
                _events = events;
                server.inject({
                  method: 'GET',
                  url: '/events?token=tokenCode',
                  headers: {
                    authorization: 'Hoist apiKey'
                  }
                }, function (response) {
                  response.payload = JSON.parse(response.payload);
                  _response = response;
                  done();
                });
              });
          });
          after(function () {
            return BBPromise.all([
              Model.EventToken.removeAsync(),
              Model.Event.removeAsync()
            ])
          });
          it('creates a new token', function () {
            return Model.EventToken.findOneAsync({
                code: {
                  $ne: 'tokenCode'
                }
              })
              .then(function (token) {
                expect(token).to.exist;
              });
          });
          it('returns events stored since last use', function () {
            var events = _.map(_events, function (event) {
              var ev = event.toObject();
              ev.createdAt = ev.createdAt.toISOString();
              ev.updatedAt = ev.updatedAt.toISOString();
              return ev
            });
            expect(_response.payload.events).to.eql(events);
          });
          it('returns the new token code', function () {
            expect(_response.payload.token).to.not.eql('tokenCode');
          });
          it('responds with 201 CREATED', function () {
            expect(_response.statusCode).to.eql(201);
          });
        });
        describe('with filterBy correlationId and no filterValue in query', function () {
          var _token;
          var _response;
          var _events;
          before(function (done) {
            new Model.EventToken({
                application: 'appid',
                environment: 'live',
                code: 'tokenCode',
                lastUsed: Date.now()
              }).saveAsync()
              .then(function (token) {
                _token = token;
                return Model.Event.createAsync([{
                  applicationId: 'appid',
                  environment: 'live',
                  eventId: 'eventid1'
                }, {
                  applicationId: 'appid',
                  environment: 'live',
                  correlationId: 'eventid',
                  eventId: 'eventid2'
                }, {
                  applicationId: 'appid',
                  environment: 'live',
                  eventName: 'eventName',
                  eventId: 'eventid3'
                }])
              }).then(function (events) {
                _events = events;
                server.inject({
                  method: 'GET',
                  url: '/events?token=tokenCode&filterBy=correlationId',
                  headers: {
                    authorization: 'Hoist apiKey'
                  }
                }, function (response) {
                  response.payload = JSON.parse(response.payload);
                  _response = response;
                  done();
                });
              });
          });
          after(function () {
            return BBPromise.all([
              Model.EventToken.removeAsync(),
              Model.Event.removeAsync()
            ])
          });
          it('creates a new token', function () {
            return Model.EventToken.findOneAsync({
                code: {
                  $ne: 'tokenCode'
                }
              })
              .then(function (token) {
                expect(token).to.exist;
              });
          });
          it('returns events stored since last use', function () {
            var events = _.map(_events, function (event) {
              var ev = event.toObject();
              ev.createdAt = ev.createdAt.toISOString();
              ev.updatedAt = ev.updatedAt.toISOString();
              return ev
            });
            expect(_response.payload.events).to.eql(events);
          });
          it('returns the new token code', function () {
            expect(_response.payload.token).to.not.eql('tokenCode');
          });
          it('responds with 201 CREATED', function () {
            expect(_response.statusCode).to.eql(201);
          });
        });
        describe('with filterBy correlationId and filterValue in query', function () {
          var _token;
          var _response;
          var _events;
          before(function (done) {
            new Model.EventToken({
                application: 'appid',
                environment: 'live',
                code: 'tokenCode',
                lastUsed: Date.now()
              }).saveAsync()
              .then(function (token) {
                _token = token;
                return Model.Event.createAsync([{
                  applicationId: 'appid',
                  environment: 'live',
                  eventId: 'eventid1'
                }, {
                  applicationId: 'appid',
                  environment: 'live',
                  correlationId: 'eventid',
                  eventId: 'eventid2'
                }, {
                  applicationId: 'appid',
                  environment: 'live',
                  eventName: 'eventName',
                  eventId: 'eventid3'
                }])
              }).then(function (events) {
                _events = events;
                server.inject({
                  method: 'GET',
                  url: '/events?token=tokenCode&filterBy=correlationId&filterValue=eventid',
                  headers: {
                    authorization: 'Hoist apiKey'
                  }
                }, function (response) {
                  response.payload = JSON.parse(response.payload);
                  _response = response;
                  done();
                });
              });
          });
          after(function () {
            return BBPromise.all([
              Model.EventToken.removeAsync(),
              Model.Event.removeAsync()
            ])
          });
          it('creates a new token', function () {
            return Model.EventToken.findOneAsync({
                code: {
                  $ne: 'tokenCode'
                }
              })
              .then(function (token) {
                expect(token).to.exist;
              });
          });
          it('returns events stored since last use', function () {
            var events = _.map(_events, function (event) {
              var ev = event.toObject();
              ev.createdAt = ev.createdAt.toISOString();
              ev.updatedAt = ev.updatedAt.toISOString();
              return ev
            });
            events = _.where(events, {correlationId: 'eventid'});
            expect(_response.payload.events).to.eql(events);
          });
          it('returns the new token code', function () {
            expect(_response.payload.token).to.not.eql('tokenCode');
          });
          it('responds with 201 CREATED', function () {
            expect(_response.statusCode).to.eql(201);
          });
        });
        describe('with filterBy eventName and no filterValue in query', function () {
          var _token;
          var _response;
          var _events;
          before(function (done) {
            new Model.EventToken({
                application: 'appid',
                environment: 'live',
                code: 'tokenCode',
                lastUsed: Date.now()
              }).saveAsync()
              .then(function (token) {
                _token = token;
                return Model.Event.createAsync([{
                  applicationId: 'appid',
                  environment: 'live',
                  eventId: 'eventid1'
                }, {
                  applicationId: 'appid',
                  environment: 'live',
                  correlationId: 'eventid',
                  eventId: 'eventid2'
                }, {
                  applicationId: 'appid',
                  environment: 'live',
                  eventName: 'eventName',
                  eventId: 'eventid3'
                }])
              }).then(function (events) {
                _events = events;
                server.inject({
                  method: 'GET',
                  url: '/events?token=tokenCode&filterBy=correlationId',
                  headers: {
                    authorization: 'Hoist apiKey'
                  }
                }, function (response) {
                  response.payload = JSON.parse(response.payload);
                  _response = response;
                  done();
                });
              });
          });
          after(function () {
            return BBPromise.all([
              Model.EventToken.removeAsync(),
              Model.Event.removeAsync()
            ])
          });
          it('creates a new token', function () {
            return Model.EventToken.findOneAsync({
                code: {
                  $ne: 'tokenCode'
                }
              })
              .then(function (token) {
                expect(token).to.exist;
              });
          });
          it('returns events stored since last use', function () {
            var events = _.map(_events, function (event) {
              var ev = event.toObject();
              ev.createdAt = ev.createdAt.toISOString();
              ev.updatedAt = ev.updatedAt.toISOString();
              return ev
            });
            expect(_response.payload.events).to.eql(events);
          });
          it('returns the new token code', function () {
            expect(_response.payload.token).to.not.eql('tokenCode');
          });
          it('responds with 201 CREATED', function () {
            expect(_response.statusCode).to.eql(201);
          });
        });
        describe('with filterBy eventName and filterValue in query', function () {
          var _token;
          var _response;
          var _events;
          before(function (done) {
            new Model.EventToken({
                application: 'appid',
                environment: 'live',
                code: 'tokenCode',
                lastUsed: Date.now()
              }).saveAsync()
              .then(function (token) {
                _token = token;
                return Model.Event.createAsync([{
                  applicationId: 'appid',
                  environment: 'live',
                  eventId: 'eventid1'
                }, {
                  applicationId: 'appid',
                  environment: 'live',
                  correlationId: 'eventid',
                  eventId: 'eventid2'
                }, {
                  applicationId: 'appid',
                  environment: 'live',
                  eventName: 'eventName',
                  eventId: 'eventid3'
                }])
              }).then(function (events) {
                _events = events;
                server.inject({
                  method: 'GET',
                  url: '/events?token=tokenCode&filterBy=eventName&filterValue=eventName',
                  headers: {
                    authorization: 'Hoist apiKey'
                  }
                }, function (response) {
                  response.payload = JSON.parse(response.payload);
                  _response = response;
                  done();
                });
              });
          });
          after(function () {
            return BBPromise.all([
              Model.EventToken.removeAsync(),
              Model.Event.removeAsync()
            ])
          });
          it('creates a new token', function () {
            return Model.EventToken.findOneAsync({
                code: {
                  $ne: 'tokenCode'
                }
              })
              .then(function (token) {
                expect(token).to.exist;
              });
          });
          it('returns events stored since last use', function () {
            var events = _.map(_events, function (event) {
              var ev = event.toObject();
              ev.createdAt = ev.createdAt.toISOString();
              ev.updatedAt = ev.updatedAt.toISOString();
              return ev
            });
            events = _.where(events, {eventName: 'eventName'});
            expect(_response.payload.events).to.eql(events);
          });
          it('returns the new token code', function () {
            expect(_response.payload.token).to.not.eql('tokenCode');
          });
          it('responds with 201 CREATED', function () {
            expect(_response.statusCode).to.eql(201);
          });
        });
        describe('with invalid filterBy in query', function () {
          var _token;
          var _response;
          var _events;
          before(function (done) {
            new Model.EventToken({
                application: 'appid',
                environment: 'live',
                code: 'tokenCode',
                lastUsed: Date.now()
              }).saveAsync()
              .then(function (token) {
                _token = token;
                return Model.Event.createAsync([{
                  applicationId: 'appid',
                  environment: 'live',
                  eventId: 'eventid1'
                }, {
                  applicationId: 'appid',
                  environment: 'live',
                  correlationId: 'eventid',
                  eventId: 'eventid2'
                }, {
                  applicationId: 'appid',
                  environment: 'live',
                  eventName: 'eventName',
                  eventId: 'eventid3'
                }])
              }).then(function (events) {
                _events = events;
                server.inject({
                  method: 'GET',
                  url: '/events?token=tokenCode&filterBy=filterBy&filterValue=eventName',
                  headers: {
                    authorization: 'Hoist apiKey'
                  }
                }, function (response) {
                  response.payload = JSON.parse(response.payload);
                  _response = response;
                  done();
                });
              });
          });
          after(function () {
            return BBPromise.all([
              Model.EventToken.removeAsync(),
              Model.Event.removeAsync()
            ])
          });
          it('creates a new token', function () {
            return Model.EventToken.findOneAsync({
                code: {
                  $ne: 'tokenCode'
                }
              })
              .then(function (token) {
                expect(token).to.exist;
              });
          });
          it('returns events stored since last use', function () {
            var events = _.map(_events, function (event) {
              var ev = event.toObject();
              ev.createdAt = ev.createdAt.toISOString();
              ev.updatedAt = ev.updatedAt.toISOString();
              return ev
            });
            expect(_response.payload.events).to.eql(events);
          });
          it('returns the new token code', function () {
            expect(_response.payload.token).to.not.eql('tokenCode');
          });
          it('responds with 201 CREATED', function () {
            expect(_response.statusCode).to.eql(201);
          });
        });
      });
      describe('with no events since last use', function () {
        describe('with events in timeout', function () {
          var _token;
          var _response;
          var _event;
          before(function (done) {
            setTimeout(function () {
              new Model.Event({
                applicationId: 'appid',
                environment: 'live'
              }).saveAsync().then(function (event) {
                _event = event;
              });
            }, 1000);
            new Model.EventToken({
                application: 'appid',
                environment: 'live',
                code: 'tokenCode',
                lastUsed: Date.now()
              }).saveAsync()
              .then(function (token) {
                _token = token;
                server.inject({
                  method: 'GET',
                  url: '/events?token=tokenCode&timeoutMS=2000',
                  headers: {
                    authorization: 'Hoist apiKey'
                  }
                }, function (response) {
                  response.payload = JSON.parse(response.payload);
                  _response = response;
                  done();
                });
              });
          });
          after(function () {
            return BBPromise.all([
              Model.EventToken.removeAsync(),
              Model.Event.removeAsync()
            ])
          });
          it('returns an event', function () {
            var event = _event.toObject();
            event.createdAt = event.createdAt.toISOString();
            event.updatedAt = event.updatedAt.toISOString();
            expect(_response.payload.events).to.eql([event]);
          });
          it('creates a new token', function () {
            return Model.EventToken.findOneAsync({
                code: {
                  $ne: 'tokenCode'
                }
              })
              .then(function (token) {
                expect(token).to.exist;
              });
          });
          it('returns the new token code', function () {
            expect(_response.payload.token).to.not.eql('tokenCode');
          });
          it('resets token timeout', function () {
            return Model.EventToken.findOneAsync({
              code: _response.payload.token
            }).then(function (token) {
              expect(token.lastUsed).to.be.above(_token.lastUsed);
            });
          });
          it('responds with 201 CREATED', function () {
            expect(_response.statusCode).to.eql(201);
          });
        });
        describe('with no events in timeout', function () {
          var _token;
          var _response;
          before(function (done) {
            new Model.EventToken({
                application: 'appid',
                environment: 'live',
                code: 'tokenCode',
                lastUsed: Date.now()
              }).saveAsync()
              .then(function (token) {
                _token = token;
                server.inject({
                  method: 'GET',
                  url: '/events?token=tokenCode&timeoutMS=2000',
                  headers: {
                    authorization: 'Hoist apiKey'
                  }
                }, function (response) {
                  response.payload = JSON.parse(response.payload);
                  _response = response;
                  done();
                });
              });
          });
          after(function () {
            return Model.EventToken.removeAsync();
          });
          it('returns no events', function () {
            expect(_response.payload.events).to.eql([]);
          });
          it('creates a new token', function () {
            return Model.EventToken.findOneAsync({
                code: {
                  $ne: 'tokenCode'
                }
              })
              .then(function (token) {
                expect(token).to.exist;
              });
          });
          it('returns the new token code', function () {
            expect(_response.payload.token).to.not.eql('tokenCode');
          });
          it('returns after timeout', function () {
            return Model.EventToken.findOneAsync({
              code: _response.payload.token
            }).then(function (token) {
              expect(token.lastUsed).to.be.least(_token.lastUsed.getTime() + 2000);
            });
          });
          it('responds with 201 CREATED', function () {
            expect(_response.statusCode).to.eql(201);
          });
        });
      });
    });
    describe('with an expired token', function () {
      describe('with events in timeout', function () {
        var _token;
        var _response;
        var _event;
        before(function (done) {
          setTimeout(function () {
            new Model.Event({
              applicationId: 'appid',
              environment: 'live'
            }).saveAsync().then(function (event) {
              _event = event;
            });
          }, 1000);
          new Model.EventToken({
              application: 'appid',
              environment: 'live',
              code: 'tokenCode',
              lastUsed: Date.now() - 15 * 60 * 1000
            }).saveAsync()
            .then(function (token) {
              _token = token;
              server.inject({
                method: 'GET',
                url: '/events?token=tokenCode&timeoutMS=2000',
                headers: {
                  authorization: 'Hoist apiKey'
                }
              }, function (response) {
                response.payload = JSON.parse(response.payload);
                _response = response;
                done();
              });
            });
        });
        after(function () {
          return BBPromise.all([
            Model.EventToken.removeAsync(),
            Model.Event.removeAsync()
          ])
        });
        it('returns an event', function () {
          var event = _event.toObject();
          event.createdAt = event.createdAt.toISOString();
          event.updatedAt = event.updatedAt.toISOString();
          expect(_response.payload.events).to.eql([event]);
        });
        it('creates a new token', function () {
          return Model.EventToken.findOneAsync({
              code: {
                $ne: 'tokenCode'
              }
            })
            .then(function (token) {
              expect(token).to.exist;
            });
        });
        it('returns new token code', function () {
          expect(_response.payload.token).to.not.eql('tokenCode');
        });
        it('responds with 201 CREATED', function () {
          expect(_response.statusCode).to.eql(201);
        });
      });
      describe('with no events in timeout', function () {
        var _time;
        var _token;
        var _response;
        before(function (done) {
          _time = Date.now();
          new Model.EventToken({
              application: 'appid',
              environment: 'live',
              code: 'tokenCode',
              lastUsed: Date.now() - 15 * 60 * 1000
            }).saveAsync()
            .then(function (token) {
              _token = token;
              server.inject({
                method: 'GET',
                url: '/events?token=tokenCode&timeoutMS=2000',
                headers: {
                  authorization: 'Hoist apiKey'
                }
              }, function (response) {
                response.payload = JSON.parse(response.payload);
                _response = response;
                done();
              });
            });
        });
        after(function () {
          return Model.EventToken.removeAsync();
        });
        it('returns no events', function () {
          expect(_response.payload.events).to.eql([]);
        });
        it('creates a new token', function () {
          return Model.EventToken.findOneAsync({
              code: {
                $ne: 'tokenCode'
              }
            })
            .then(function (token) {
              expect(token).to.exist;
            });
        });
        it('returns new token code', function () {
          expect(_response.payload.token).to.not.eql('tokenCode');
        });
        it('returns after timeout', function () {
          return Model.EventToken.findOneAsync({
              code: _response.payload.token
            })
            .then(function (token) {
              expect(token.lastUsed.getTime()).to.be.least(_time + 2000);
            });
        });
        it('responds with 201 CREATED', function () {
          expect(_response.statusCode).to.eql(201);
        });
      });
    });
    describe('with a non existing token', function () {
      describe('with events in timeout', function () {
        var _token;
        var _response;
        var _event;
        before(function (done) {
          setTimeout(function () {
            new Model.Event({
              applicationId: 'appid',
              environment: 'live'
            }).saveAsync().then(function (event) {
              _event = event;
            });
          }, 1000);
          new Model.EventToken({
              application: 'appid',
              environment: 'live',
              code: 'tokenCode',
              lastUsed: Date.now() - 15 * 60 * 1000
            }).saveAsync()
            .then(function (token) {
              _token = token;
              server.inject({
                method: 'GET',
                url: '/events?token=fakeTokenCode&timeoutMS=2000',
                headers: {
                  authorization: 'Hoist apiKey'
                }
              }, function (response) {
                response.payload = JSON.parse(response.payload);
                _response = response;
                done();
              });
            });
        });
        after(function () {
          return BBPromise.all([
            Model.EventToken.removeAsync(),
            Model.Event.removeAsync()
          ])
        });
        it('returns an event', function () {
          var event = _event.toObject();
          event.createdAt = event.createdAt.toISOString();
          event.updatedAt = event.updatedAt.toISOString();
          expect(_response.payload.events).to.eql([event]);
        });
        it('creates a new token', function () {
          return Model.EventToken.findOneAsync({
              code: {
                $ne: 'tokenCode'
              }
            })
            .then(function (token) {
              expect(token).to.exist;
            });
        });
        it('returns new token code', function () {
          expect(_response.payload.token).to.not.eql('tokenCode');
        });
        it('responds with 201 CREATED', function () {
          expect(_response.statusCode).to.eql(201);
        });
      });
      describe('with no events in timeout', function () {
        var _time;
        var _token;
        var _response;
        before(function (done) {
          _time = Date.now();
          new Model.EventToken({
              application: 'appid',
              environment: 'live',
              code: 'tokenCode',
              lastUsed: Date.now() - 15 * 60 * 1000
            }).saveAsync()
            .then(function (token) {
              _token = token;
              server.inject({
                method: 'GET',
                url: '/events?token=fakeTokenCode&timeoutMS=2000',
                headers: {
                  authorization: 'Hoist apiKey'
                }
              }, function (response) {
                response.payload = JSON.parse(response.payload);
                _response = response;
                done();
              });
            });
        });
        after(function () {
          return Model.EventToken.removeAsync();
        });
        it('returns no events', function () {
          expect(_response.payload.events).to.eql([]);
        });
        it('creates a new token', function () {
          return Model.EventToken.findOneAsync({
              code: {
                $ne: 'tokenCode'
              }
            })
            .then(function (token) {
              expect(token).to.exist;
            });
        });
        it('returns new token code', function () {
          expect(_response.payload.token).to.not.eql('tokenCode');
        });
        it('returns after timeout', function () {
          return Model.EventToken.findOneAsync({
              code: {
                $ne: 'tokenCode'
              }
            })
            .then(function (token) {
              expect(token.lastUsed.getTime()).to.be.least(_time + 2000);
            });
        });
        it('responds with 201 CREATED', function () {
          expect(_response.statusCode).to.eql(201);
        });
      });
    });
  });
});