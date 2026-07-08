# AstraSRE Kubernetes Deployment Guide

Instructions for deploying to production Kubernetes clusters:
- Namespace configuration: `astrasre`
- Deployment commands: `kubectl apply -f k8s/`
- Autoscaling is configured using HPA (`k8s/hpa.yaml`) scaling payment pods up to 5 replicas.
