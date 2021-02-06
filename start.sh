#!/bin/sh

docker build -t r2:latest .
docker run --rm -it r2:latest