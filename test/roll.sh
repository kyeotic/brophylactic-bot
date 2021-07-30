#!/usr/bin/env bash

curl -vX POST http://0.0.0.0:8080 -d @test/roll-command.json \
--header "Content-Type: application/json"