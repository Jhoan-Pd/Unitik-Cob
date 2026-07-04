# Lista inicial de Casos de Uso — Unitik-Cob

**Artefacto OpenUP — Fase de Inicio (Iteración 0)**

Actores: **Administrador (ADMIN)**, **Técnico (TECHNICIAN)**, **Cajero (CASHIER)**, **Cliente (CLIENT)**, **Sistema** (jobs automáticos), **Pasarela de pago** (Wompi/Nequi webhook).

## Gestión de autenticación y usuarios

| ID | Caso de uso | Actor principal | Prioridad | Iteración |
| --- | --- | --- | --- | --- |
| CU-01 | Iniciar sesión con documento/email y contraseña | Todos | Alta | 1 |
| CU-02 | Renovar sesión con refresh token | Todos | Alta | 1 |
| CU-03 | Gestionar usuarios y roles (RBAC) | Administrador | Alta | 1 |

## Gestión de clientes y planes

| ID | Caso de uso | Actor principal | Prioridad | Iteración |
| --- | --- | --- | --- | --- |
| CU-04 | Crear/editar/suspender/reactivar/cancelar cliente | Administrador | Alta | 3 |
| CU-05 | Registrar cliente nuevo con captura GPS | Técnico | Alta | 3 |
| CU-06 | Gestionar planes (velocidad, precio, reúso, TV) | Administrador | Alta | 3 |
| CU-07 | Asignar plan a cliente (suscripción) | Administrador / Técnico | Alta | 3 |
| CU-08 | Consultar información personal y plan contratado | Cliente | Media | 3 |

## Facturación y pagos

| ID | Caso de uso | Actor principal | Prioridad | Iteración |
| --- | --- | --- | --- | --- |
| CU-09 | Generar facturas mensuales automáticamente (cron día 1) | Sistema | Alta | 4 |
| CU-10 | Calcular interés por mora configurable | Sistema | Alta | 4 |
| CU-11 | Registrar pago en efectivo con recibo | Cajero | Alta | 4 |
| CU-12 | Subir comprobante Nequi/transferencia | Cliente | Alta | 4 |
| CU-13 | Validar pago manualmente (aprobar/rechazar comprobante) | Administrador / Cajero | Alta | 4 |
| CU-14 | Validar pago automáticamente por webhook | Pasarela de pago | Alta | 4 |
| CU-15 | Registrar promesa de pago (7 o 15 días) | Administrador | Media | 4 |
| CU-16 | Aplicar doble mensualidad por mora prolongada | Sistema | Media | 4 |
| CU-17 | Aprobar descuento con motivo | Administrador | Media | 4 |
| CU-18 | Pagar en línea (Wompi/Nequi/PSE) | Cliente | Alta | 4 |
| CU-19 | Emitir factura electrónica DIAN (CUFE) | Sistema | Media | 4 |
| CU-20 | Descargar factura electrónica en PDF | Cliente | Media | 4 |
| CU-21 | Cierre de caja diario con reporte | Cajero | Alta | 6 |

## Red (MikroTik RouterBoard)

| ID | Caso de uso | Actor principal | Prioridad | Iteración |
| --- | --- | --- | --- | --- |
| CU-22 | Reconectar cliente automáticamente al validarse el pago | Sistema | **Crítica** | 5 |
| CU-23 | Suspender cliente automáticamente al vencer la factura | Sistema | **Crítica** | 5 |
| CU-24 | Gestionar dispositivos de red (RouterBoards) | Administrador | Alta | 5 |
| CU-25 | Editar usuarios PPPoE/colas/DHCP en RouterBoard | Administrador | Media | 5 |
| CU-26 | Cambiar perfil PPPoE al cambiar de plan | Sistema | Alta | 5 |
| CU-27 | Ver estado online/offline de dispositivos | Administrador | Media | 5 |
| CU-28 | Solicitar reconexión (cliente que ya pagó) | Cliente | Media | 5 |

## Soporte e instalaciones

| ID | Caso de uso | Actor principal | Prioridad | Iteración |
| --- | --- | --- | --- | --- |
| CU-29 | Crear y dar seguimiento a tickets de soporte | Cliente / Todos | Alta | 6 |
| CU-30 | Atender tickets asignados | Técnico | Alta | 6 |
| CU-31 | Elaborar acta de instalación con firma digital | Técnico | Alta | 6 |
| CU-32 | Registrar metros de cable y equipos (radio enlace) | Técnico | Media | 6 |

## Gobernanza, auditoría y reportes

| ID | Caso de uso | Actor principal | Prioridad | Iteración |
| --- | --- | --- | --- | --- |
| CU-33 | Registrar toda operación crítica en AuditLog | Sistema | **Crítica** | 2 |
| CU-34 | Consultar y exportar auditoría (CSV/PDF) | Administrador | Alta | 6 |
| CU-35 | Configurar parámetros del sistema (mora, cortes, precios) | Administrador | Alta | 2 |
| CU-36 | Ver dashboard con KPIs | Administrador | Alta | 6 |
| CU-37 | Generar reportes exportables (cartera, recaudo, morosidad) | Administrador | Alta | 6 |
| CU-38 | Recibir notificaciones (WhatsApp/email/SMS/in-app) | Cliente / Administrador | Alta | 6 |
| CU-39 | Consultar métricas experimentales (BASELINE/POST) | Administrador | Media | 7 |

> Los casos de uso críticos CU-22, CU-23 y CU-33 dirigen la arquitectura (prototipo arquitectónico de la Fase de Elaboración).
