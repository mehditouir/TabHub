# TabHub — UML Diagrams

All diagrams are in **Mermaid** format, embedded in Markdown files.

## How to view

**VS Code** — Open any `.md` file and press `Ctrl+Shift+V` (Markdown Preview).
Mermaid renders natively — no extensions, no Java, no server needed.

**GitHub** — Mermaid diagrams render automatically in any `.md` file.

**Online** — Paste any diagram block at [mermaid.live](https://mermaid.live).

---

## Diagram Index

| # | File | Type | Description |
|---|------|------|-------------|
| 01 | `01-architecture-deployment.md` | Component / Deployment | Full Azure architecture, client devices, restaurant network |
| 02 | `02-erd-platform-schema.md` | ERD | Public schema: tenants, managers, access, refresh tokens |
| 03 | `03-erd-setup-schema.md` | ERD | Tenant schema: spaces, tables, staff, waiter zones, configs |
| 04 | `04-erd-menus-schema.md` | ERD | Menus, categories, items, ingredients, modifier options |
| 05 | `05-erd-orders-schema.md` | ERD | Sessions, orders, bills, notifications, audit logs |
| 06 | `06-usecase.md` | Use Case | All actors and their use cases |
| 07 | `07-class-domain.md` | Class | Full domain model with entities, enums, relationships |
| 08 | `08-sequence-qr-scan-to-order.md` | Sequence | QR scan → session → menu browse → order submitted |
| 09 | `09-sequence-waiter-validation.md` | Sequence | Notification ACK → waiter validates → kitchen notified |
| 10 | `10-sequence-kitchen-flow.md` | Sequence | Kitchen prepares order → item rejection flow |
| 11 | `11-sequence-signalr-notification-ack.md` | Sequence | SignalR group topology + competing consumer ACK |
| 12 | `12-sequence-auth.md` | Sequence | Manager JWT login, staff PIN login, tenant resolution |
| 13 | `13-sequence-table-operations.md` | Sequence | Move session, merge sessions, close session |
| 14 | `14-sequence-menu-scheduling.md` | Sequence | Schedule engine evaluation + cache invalidation |
| 15 | `15-sequence-pdf-bill.md` | Sequence | Bill request → TVA calculation → PDF → print |
| 16 | `16-sequence-takeaway-order.md` | Sequence | Cashier creates takeaway → kitchen → display screen |
| 17 | `17-sequence-image-upload.md` | Sequence | Photo upload → resize → Blob Storage → CDN delivery |
