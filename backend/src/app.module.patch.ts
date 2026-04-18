/**
 * PATCH: backend/src/app.module.ts
 *
 * Dodaj GraphSyncModule do imports[].
 * GraphController jest w GraphSyncModule — rejestruje endpointy webhook.
 *
 * UWAGA: GraphSyncModule musi być importowany PRZEZ AppModule
 * żeby endpointy GraphController były zarejestrowane na poziomie aplikacji.
 * Importowanie tylko w ReservationsModule NIE rejestruje kontrolera.
 */

// Dodaj import:
import { GraphSyncModule } from './modules/graph-sync/graph-sync.module';

// Dodaj do tablicy imports w @Module({ imports: [...] }):
//   IntegrationsModule,   // ← już jest ze Sprint F
//   GraphSyncModule,      // ← DODAJ

// Przykład (dodaj do istniejącej listy, nie zastępuj):
// @Module({
//   imports: [
//     ConfigModule.forRoot({ isGlobal: true }),
//     DatabaseModule,
//     SharedModule,
//     AuthModule,
//     UsersModule,
//     OrganizationsModule,
//     LocationsModule,
//     DesksModule,
//     DevicesModule,
//     GatewaysModule,
//     ReservationsModule,
//     CheckinsModule,
//     NotificationsModule,
//     InAppNotificationsModule,
//     MqttModule,
//     MetricsModule,
//     OwnerModule,
//     ScheduleModule.forRoot(),
//     ThrottlerModule.forRoot([...]),
//     IntegrationsModule,    // ← Sprint F
//     RecommendationsModule, // ← Sprint K
//     InsightsModule,        // ← Sprint K
//     GraphSyncModule,       // ← DODAJ
//   ],
// })
