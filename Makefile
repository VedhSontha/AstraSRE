# AstraSRE Makefile for development shortcuts

.PHONY: up down restart test logs

up:
	docker-compose up --build -d

down:
	docker-compose down

restart: down up

test:
	python -m unittest discover -s tests

logs:
	docker-compose logs -f

health:
	curl -s http://localhost:5000/health | python -m json.tool

lint:
	flake8 *.py services/ tests/ --max-line-length=120
