# Manual de Usuario — Unitik-Cob

**Artefacto OpenUP — Fase de Transición (Iteración 7)** · Para el personal de UNITIK y sus clientes.

## Ingreso al sistema

Abra la dirección del sistema en el navegador e ingrese con su **correo o cédula** y su contraseña.
- **Clientes**: la primera contraseña es su número de cédula.
- Si olvida la contraseña, el administrador puede asignarle una nueva.

---

## 👨‍💼 Administrador

- **Inicio (KPIs)**: clientes activos, ingresos del mes, morosos, tickets abiertos y estado de la red. Los pagos aparecen **en tiempo real**.
- **Cartera**: ranking de morosos con deuda vencida; botones para descargar los reportes de **Recaudo** y **Clientes por plan** (se abren en Excel).
- **Auditoría**: todos los movimientos del sistema (quién, cuándo, desde dónde, qué cambió). Botón **Exportar CSV** para la evidencia de gobernanza.
- **Gestión** (por API/Swagger mientras se amplía la interfaz): usuarios, planes, parámetros (interés de mora, fechas de corte), descuentos con motivo, promesas de pago (7 o 15 días), anulación de facturas, dispositivos de red.
- **Suspender/reactivar clientes**: siempre exige un **motivo**, que queda en la auditoría.

## 💵 Cajero

1. **Buscar** al cliente por nombre o cédula → se muestra su estado de cuenta (deuda total y facturas abiertas).
2. **Recibir efectivo**: presione el botón en la factura que paga el cliente → el sistema muestra el **recibo** (número REC-…). Si el cliente estaba suspendido, la reconexión inicia sola — no hay que avisarle a nadie.
3. **Cierre de caja**: al final del día, la pantalla muestra cuántos pagos recibió y el total recaudado, pago por pago.

## 🔧 Técnico

- **Mis tickets**: la lista muestra solo los tickets asignados a usted, ordenados por prioridad. Avance el estado con un clic (Abierto → En progreso → Resuelto → Cerrado).
- **Instalaciones**: registre el acta con los equipos usados, metros de cable (radio enlace), si el cliente pagó equipos, observaciones y la firma del cliente.
- **Clientes nuevos**: regístrelos con la ubicación GPS del punto de instalación y asígneles el plan.

## 👤 Cliente (portal)

- **Mi información**: datos personales, dirección y estado del servicio.
- **Mi plan**: velocidad contratada, precio mensual y fecha de corte.
- **Mis facturas**: cada factura muestra el mes, la fecha límite y el estado (Pendiente / Pagada / Vencida / Promesa de pago).
- **Notificaciones**: avisos de vencimiento, rechazos de comprobante y recordatorios de promesa.
- **Soporte**: cree un ticket describiendo su problema y siga su estado.
- Si pagó por Nequi o transferencia, su pago queda **en verificación**; al aprobarse, la reconexión es automática en menos de 5 minutos.

---

## Preguntas frecuentes

**¿Por qué me suspendieron si iba a pagar?** — Pida en la oficina una **promesa de pago** (7 o 15 días): la suspensión automática respeta las promesas vigentes.

**Pagué y sigo sin servicio.** — Si pagó en efectivo o en línea, la reconexión tarda menos de 5 minutos. Si envió comprobante de Nequi/transferencia, debe ser verificado primero; recibirá una notificación si fue rechazado y el motivo.

**¿Puedo cambiar de plan?** — Sí: solicítelo en la oficina; el cambio de velocidad se aplica automáticamente en la red.
