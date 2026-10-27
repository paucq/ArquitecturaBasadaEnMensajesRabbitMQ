# Ejecutar en Windows con PowerShell, sin WSL

## 1. Preparar Docker Desktop

Esta receta requiere Windows de 64 bits Pro, Enterprise o Education compatible con el backend Hyper-V de la versión instalada. **Windows Home no satisface esta receta sin WSL**. No instalar Ubuntu, ejecutar `wsl --install` ni cambiar a contenedores Windows para intentar resolverlo.

1. Compruebe requisitos vigentes de [Docker Desktop para Windows](https://docs.docker.com/desktop/setup/install/windows-install/): virtualización habilitada en BIOS/UEFI, CPU con SLAT y al menos 8 GB RAM. Las versiones de Windows admitidas cambian; consulte esa página antes de instalar.
2. Con permisos administrativos, habilite las características de Windows **Hyper-V** y **Containers** y reinicie. Las políticas de la organización pueden impedirlo; consulte al administrador, no desactive controles de seguridad.
3. Instale Docker Desktop para todos los usuarios (all-users). En el instalador, desmarque **Use WSL 2 instead of Hyper-V** cuando se ofrezca. En Settings seleccione Hyper-V/desactive el motor WSL 2 según la versión. No habilite integración WSL.
4. Inicie Docker Desktop y seleccione **Linux containers**. Hyper-V es el backend; Linux es el sistema de los contenedores: no son opciones contradictorias.
5. Instale Git para Windows. Instale Node.js 24 para usar `Test-Lab.ps1`; no se necesita Node en el host solo para arrancar la aplicación. Postman CLI y GUI son opcionales.

Compruebe en una terminal PowerShell nueva:

```powershell
docker version
if ($LASTEXITCODE -ne 0) { throw 'Docker no disponible' }
docker compose version
if ($LASTEXITCODE -ne 0) { throw 'Compose no disponible' }
docker info --format '{{.OSType}}'
if ($LASTEXITCODE -ne 0) { throw 'Motor no disponible' }
```

La última salida debe ser `linux`. Esto no verifica por sí solo que el backend sea Hyper-V: compruébelo también en Docker Desktop. Se requiere Compose v2 con `--wait` y `--wait-timeout`.

## 2. Arrancar desde la raíz del repositorio

Use los comandos del [inicio rápido](../README.md). Rutas con espacios funcionan porque los scripts usan `$PSScriptRoot`, `Join-Path`, argumentos separados y `Push-Location`; no se construyen cadenas para `Invoke-Expression`.

`Start-Lab.ps1` usa `up -d --build --wait --wait-timeout 120`, verifica cuatro contenedores activos, dos workers y consulta `/health` hasta 12 veces (timeout de 5 segundos por consulta). La descarga/construcción inicial puede tardar más que el periodo de espera de salud; no cierre Docker durante ese proceso. Puede ampliar la espera:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows\Start-Lab.ps1 -WaitTimeout 300
```

Los puertos predeterminados son API 3000, Management 15672, AMQP 5672. Los tres scripts aceptan `-ProjectName`, `-ApiPort`, `-ManagementPort`, `-AmqpPort`. Repita los mismos parámetros en todos; vea el ejemplo aislado del README. No ejecute comandos sobre el proyecto histórico `qa-taller-integracion-rabbitmq`.

Compose acepta `API_PORT`, `RABBITMQ_MANAGEMENT_PORT` y `RABBITMQ_AMQP_PORT`; los scripts fijan esos valores solo durante su ejecución y restauran el entorno anterior incluso ante error. No requieren `.env`. La URL AMQP interna sigue siendo `amqp://admin:admin@rabbitmq:5672`, independientemente de los puertos externos. `AMQP_URL` es la variable real usada por la aplicación; el nombre de cola `pedidos` es constante.

## 3. Verificar por etapas

1. **Salud:** `/health` devuelve `ready`; no envía pedidos.
2. **Publicación manual:** el ejemplo PowerShell del README envía JSON con `customerName`, `product` y `quantity` entera positiva. `Invoke-RestMethod` deserializa la respuesta; HTTP 400 produce una excepción. No usar `curl` como si fuera Bash: en Windows PowerShell puede ser un alias.
3. **Trazabilidad:** correlacione `orderId` con `order_published`, `order_received` y `order_processed` en logs. Management → `pedidos` permite observar mensajes pendientes/no confirmados y consumidores. Dos workers deberían conectarse, pero la cifra puede tardar en refrescarse.
4. **Runner:** ejecute `Test-Lab.ps1`. Usa `API_URL=http://127.0.0.1:<ApiPort>` y `RABBITMQ_UI_URL=http://127.0.0.1:<ManagementPort>`. Verifica las publicaciones reales de puertos antes de probar y establece `COMPOSE_PROJECT_NAME` para los comandos Docker internos del test.

El runner original requiere **Docker CLI en el proceso Node** para parar/iniciar workers y leer logs. El Dockerfile no incluye CLI Docker ni copia `pruebas/`. Por ello **no funciona `docker compose exec orders-api npm test`** y no se monta el socket Docker como atajo. Sin modificar la aplicación se usa Node.js 24 en el host y `npm.cmd ci` + `npm.cmd test`. `npm.cmd` evita el bloqueo del shim `npm.ps1` por la política de ejecución. `npm ci` necesita acceso al registro y genera `node_modules` local, ignorado por Git.

Se esperan 2 tests aprobados: publicación/persistencia/correlación/procesamiento del mismo ID y rechazo de cantidad cero. El primero detiene ambas réplicas, inspecciona hasta 100 mensajes con reencolado y registra limpieza para arrancarlas incluso si falla la prueba. No garantiza limpieza ante cierre abrupto del proceso: si se interrumpe, vuelva a ejecutar Start-Lab. No promete orden ni exactamente una vez. No equivale a ejecutar los diez reportes históricos.

## Postman local

Descargue Postman CLI para Windows desde la [documentación oficial](https://learning.postman.com/docs/postman-cli/postman-cli-installation/), agréguelo al PATH y abra PowerShell de nuevo. No requiere login para ejecutar esta colección local; no usar nube, `login` ni `--output`.

Desde la raíz del repositorio, este selector corresponde al nombre exacto del primer item de la colección:

```powershell
postman collection run .\rabbitmq\pruebas\RabbitMQ.postman_collection.json -i 'Crear pedido — esperado HTTP 202' --env-var 'baseUrl=http://localhost:3000' --no-report-events --verbose
if ($LASTEXITCODE -ne 0) { throw 'Postman CLI reporto error' }
```

En PowerShell 5.1, pegue el nombre completo con su raya larga; no lo sustituya por un guion corto. Para puertos alternos cambie `baseUrl` a `http://localhost:3300`. Quitar `-i` ejecuta ambos items (aceptación y cantidad inválida). Cada ejecución crea pedidos adicionales; no es una reproducción exacta de evidencias anteriores. La salida incluye datos del pedido: use solo datos ficticios.

Alternativa GUI opcional: importe `rabbitmq/pruebas/RabbitMQ.postman_collection.json`, ajuste la variable de colección `baseUrl` y ejecute los dos requests. La colección es local y no exige compartirla en un workspace remoto. Conserve evidencia nueva separada, identificando fecha, proyecto, puertos y plataforma; nunca sobrescriba capturas originales.

## Diagnóstico y apagado

| Síntoma | Acción acotada |
|---|---|
| Puerto ocupado | Cambie los tres puertos con los parámetros; no cierre contenedores ajenos. Puede inspeccionar `Get-NetTCPConnection -LocalPort 3000,15672,5672 -ErrorAction SilentlyContinue`. |
| Docker no responde | Abra Desktop, espere el motor y verifique contexto/configuración Linux y Hyper-V. |
| Características Hyper-V ausentes | Compruebe edición de Windows y virtualización. Home necesita otro entorno compatible, no esta receta. |
| Bloqueo de scripts | Use `powershell -NoProfile -ExecutionPolicy Bypass -File <ruta-del-script>` como en README: afecta solo ese proceso. No cambie LocalMachine ni use Unrestricted. Una Group Policy puede prevalecer: consulte al administrador. |
| Test no encuentra API/Management | Repita nombre y puertos de Start-Lab; compruebe que los contenedores siguen activos. |
| Management rechaza admin/admin | Un volumen previo conserva credenciales anteriores. No borre el volumen para ocultar el problema: use otro nombre de proyecto para un laboratorio separado. |
| Test falla por cola acumulada | Revise mensajes y logs; no purgue para fabricar un resultado. Use un proyecto de verificación independiente. |

Para consultar exclusivamente este proyecto (ajuste el nombre si lo cambió):

```powershell
docker compose --project-name arquitectura-basada-mensajes-rabbitmq --file .\rabbitmq\docker-compose.yml ps
docker compose --project-name arquitectura-basada-mensajes-rabbitmq --file .\rabbitmq\docker-compose.yml logs --tail 100 orders-api notification-worker
```

Apague con `Stop-Lab.ps1` y los mismos parámetros. Ejecuta `down` **sin eliminar volúmenes**. Los pedidos persistentes pueden reaparecer al arrancar de nuevo. No se utiliza purga, `kill`, ni eliminación de volumen como flujo normal.

## Alcance de la comprobación

Esta guía se preparó mediante lectura de fuentes y revisión estática; no se ha validado aquí PowerShell 5.1/Hyper-V. Las evidencias Linux/WSL conservadas prueban sus corridas originales, no este procedimiento Windows. La instalación Docker y el primer build requieren red; ejecutar colección local sin login no implica instalación offline.
