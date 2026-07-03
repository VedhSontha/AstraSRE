name: Bug report
about: Create a report to help us improve
title: '[BUG] '
labels: bug
assignees: ''
body:
  - type: markdown
    attributes:
      value: Please describe the bug clearly.
  - type: textarea
    id: reproduce
    attributes:
      label: Steps to Reproduce
      placeholder: |
        1. Inject 'db_timeout' to payment
        2. Watch anomaly logging...
