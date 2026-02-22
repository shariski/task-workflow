# Task Workflow API

Task workflow service built using ExpressJS & SQLite.

------------------------------------------------------------------------

## 🏗 Architecture Overview

    domain/          → Entities + state machine
    application/     → Usecases (transaction orchestration)
    infrastructure/  → SQLite + repositories
    http/            → Express controllers + routes

Dependency direction:

    http → application → domain
    infrastructure → domain

------------------------------------------------------------------------

## 🚀 How to Run

### 1. Install dependencies

``` bash
npm install
```

### 2. Run development server

``` bash
npm run dev
```

Or:

``` bash
npm run build
npm start
```

Server runs at:

    http://localhost:3000

------------------------------------------------------------------------

## 🧪 How to Test

You can test using:

-   curl (examples below)
-   Postman
-   Any REST client

Or just run vitest:

``` bash
NODE_ENV=test npm test

```

------------------------------------------------------------------------

## 📡 Sample cURL Commands

### Create Task (Idempotent)

``` bash
curl -X POST http://localhost:3000/v1/workspaces/ws_1/tasks   -H "Content-Type: application/json"   -H "X-Tenant-Id: tenant_1"   -H "X-Role: manager"   -H "X-User-Id: u_manager"   -H "Idempotency-Key: create-001"   -d '{
    "title": "Follow up customer",
    "priority": "HIGH"
  }'
```

### Assign Task (Manager Only)

``` bash
curl -X POST http://localhost:3000/v1/workspaces/ws_1/tasks/TASK_ID/assign   -H "Content-Type: application/json"   -H "X-Tenant-Id: tenant_1"   -H "If-Match-Version: 1"   -d '{
    "assignee_id": "u_agent"
  }'
```

### Transition Task

``` bash
curl -X POST http://localhost:3000/v1/workspaces/ws_1/tasks/TASK_ID/transition   -H "Content-Type: application/json"   -H "X-Tenant-Id: tenant_1"   -H "X-Role: agent"   -H "X-User-Id: u_agent"   -H "If-Match-Version: 2"   -d '{
    "to_state": "IN_PROGRESS"
  }'
```

### Get Task + Timeline

``` bash
curl -X GET http://localhost:3000/v1/workspaces/ws_1/tasks/TASK_ID   -H "X-Tenant-Id: tenant_1"
```

### List Tasks

``` bash
curl -X GET "http://localhost:3000/v1/workspaces/ws_1/tasks?state=IN_PROGRESS&limit=20"   -H "X-Tenant-Id: tenant_1"
```

### Get Events (Outbox)

``` bash
curl -X GET "http://localhost:3000/v1/events?limit=50"   -H "X-Tenant-Id: tenant_1"
```

------------------------------------------------------------------------

## 🧠 Brief Notes

### 1. State Machine + Authorization

Entity layer is responsible for managing state and authorization. Inside src/domain/task.ts there is a Task class that having constructor and getter. State validations are happen in here.

------------------------------------------------------------------------

### 2. Idempotency + Optimistic Locking

#### Idempotency

-   Client may provide `Idempotency-Key`
-   Composite unique constraint: (tenant_id, workspace_id, idempotency_key)
-   Insert attempted inside transaction
-   On constraint violation → existing task returned

Ensures no duplicate tasks even under concurrent requests.

#### Optimistic Locking

-   Each task has a `version` column
-   Updates use: WHERE task_id = ? AND version = ? (see src/infrastructure/repository.ts line 142)
-   If affected rows = 0 → 409 Conflict

Prevents lost updates under concurrency.

------------------------------------------------------------------------

### 3. Outbox Pattern

All state-changing operations:

-   Insert/update task
-   Insert event

Are executed within the same transaction, so it can be rolled back if partial failure happens.

Events stored in `task_events`:

-   TaskCreated
-   TaskAssigned
-   TaskStateChanged

Guarantees strong consistency without external broker.

