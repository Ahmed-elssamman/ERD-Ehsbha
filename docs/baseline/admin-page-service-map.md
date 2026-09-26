# Admin Page → Service Map

| Page file | Route | Activity | API Client Method | Endpoint | Required Permission | Data Source | Status | Owner | Follow-up |
|---|---|---|---|---|---|---|---|---|---|
| apps/admin/src/pages/login | /login | active | auth.login | POST /api/v1/admin/auth/login | unrestricted | real | passed | Phase 0 | N/A |
| apps/admin/src/pages/dashboard | / | active | useDashboard | GET /api/v1/admin/dashboard/overview | dashboard.read | real | passed | Phase 0 | N/A |
| apps/admin/src/pages/users | /users | active | usersApi.list | GET /api/v1/admin/users | users.read | real | passed | Phase 0 | N/A |
| apps/admin/src/pages/user-detail | /users/:id | active | usersApi.get | GET /api/v1/admin/users/:id | users.read | real | passed | Phase 0 | N/A |
| apps/admin/src/pages/drivers | /drivers | active | driversApi.list | GET /api/v1/admin/drivers | drivers.read | real | passed | Phase 0 | N/A |
| apps/admin/src/pages/driver-detail | /drivers/:id | active | driversApi.get | GET /api/v1/admin/drivers/:id | drivers.read | real | passed | Phase 0 | N/A |
| apps/admin/src/pages/trips | /trips | active | tripsApi.list | GET /api/v1/admin/trips | trips.read | real | passed | Phase 0 | N/A |
| apps/admin/src/pages/trip-detail | /trips/:id | active | tripsApi.get | GET /api/v1/admin/trips/:id | trips.read | real | passed | Phase 0 | N/A |
| apps/admin/src/pages/vehicles | /vehicles | active | vehiclesApi.list | GET /api/v1/admin/vehicles | vehicles.read | real | passed | Phase 0 | N/A |
| apps/admin/src/pages/analytics | /analytics | active | analyticsApi.overview | GET /api/v1/admin/analytics/overview | analytics.read | real | passed | Phase 0 | N/A |
| apps/admin/src/pages/info-page | /revenue | scaffold | miscApi.revenue | GET /api/v1/admin/revenue/overview | revenue.read | scaffold | known_gap | Phase 0 | Post-billing implementation |
| apps/admin/src/pages/community | /community | active | communityApi.list | GET /api/v1/admin/community/posts | community.read | real | passed | Phase 0 | N/A |
| apps/admin/src/pages/reviews | /reviews | active | reviewsApi.list | GET /api/v1/admin/reviews | reviews.read | real | passed | Phase 0 | N/A |
| apps/admin/src/pages/support | /support | active | supportApi.list | GET /api/v1/admin/support/tickets | support.read | real | passed | Phase 0 | N/A |
| apps/admin/src/pages/support-detail | /support/:id | active | supportApi.get | GET /api/v1/admin/support/tickets/:id | support.read | real | passed | Phase 0 | N/A |
| apps/admin/src/pages/notifications | /notifications | active | notificationsApi.alerts | GET /api/v1/admin/notifications/alerts | notifications.read | real | passed | Phase 0 | N/A |
| apps/admin/src/pages/audit | /audit | active | auditApi.list | GET /api/v1/admin/audit | audit.read | real | passed | Phase 0 | N/A |
| apps/admin/src/pages/health | /health | active | miscApi.health | GET /api/v1/admin/health/snapshot | platform_health.read | real | passed | Phase 0 | N/A |
| apps/admin/src/pages/roles | /roles | active | rolesApi.roles | GET /api/v1/admin/roles | roles.read | real | passed | Phase 0 | N/A |
| apps/admin/src/pages/settings | /settings | active | settingsApi.list | GET /api/v1/admin/settings | settings.read | real | passed | Phase 0 | N/A |
