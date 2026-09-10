#!/bin/bash
# run_spec.sh — Script autónomo con ejecución por lotes y salida interactiva en tiempo real

SPEC_FILE="spec.md"
LOG_FILE=$(mktemp)

# Limpieza del archivo temporal al salir
trap 'rm -f "$LOG_FILE"' EXIT

GO_DIR=$(dirname $(find . -maxdepth 3 -name "go.mod" | head -n 1))

if [ -z "$GO_DIR" ]; then
    echo "Error: No se encontró un archivo go.mod en este proyecto."
    exit 1
fi

echo "[Info] Módulo Go detectado en: $GO_DIR"

if [ ! -f "$SPEC_FILE" ]; then
    echo "Error: No se encontró el archivo $SPEC_FILE"
    exit 1
fi

while grep -q "\- \[ \]" "$SPEC_FILE"; do
    echo ""
    echo "================================================================="
    echo " [Spec Runner] Tareas pendientes detectadas. Invocando Copilot... "
    echo "================================================================="
    echo ""

    # PROMPT SENIOR MEJORADO: Orientado a máxima eficiencia, calidad de código y mínimo gasto de tokens.
    PROMPT_TAREA="Actúa como un Senior Go Developer. Lee $SPEC_FILE y localiza la primera fase con tareas pendientes (- [ ]).

Reglas de ejecución estricta:
1. Batching Inteligente: Agrupa y ejecuta el máximo de subtareas independientes de esa fase en esta única ronda. Detente solo si una tarea depende del resultado estricto de la anterior.
2. Calidad de Código: Escribe código Go idiomático, optimizado y sin fugas de memoria. Aplica patrones de diseño limpios.
3. Actualización de Estado: Modifica el archivo $SPEC_FILE cambiando las casillas completadas a (- [x]). Si TODAS las subtareas de una fase se completan, marca también su cabecera principal a (- [x]) en la misma corrida.
4. Economía de Tokens: Prohibido usar saludos, despedidas o explicaciones largas. Finaliza tu respuesta UNICAMENTE con una lista ultra-breve de las casillas completadas."

    # Ejecución interactiva: imprime en pantalla EN VIVO y guarda en LOG_FILE
    echo "$PROMPT_TAREA" | copilot --allow-all 2>&1 | tee "$LOG_FILE"
    COPILOT_EXIT_CODE=${PIPESTATUS[1]}

    # DETENCIÓN DE SEGURIDAD: Verificar si hubo error 429 o fallo en la API
    if [ $COPILOT_EXIT_CODE -ne 0 ] || grep -iqE "429|too many requests|rate limit|quota exceeded" "$LOG_FILE"; then
        echo ""
        echo "[!] ERROR CRÍTICO: Límite de cuota o error en la API de Copilot (Exit code: $COPILOT_EXIT_CODE)."
        echo "[!] El script se detendrá para evitar bucles infinitos."
        exit 1
    fi

    # Verificación de compilación desde el directorio correcto de Go
    if ! (cd "$GO_DIR" && go build ./...); then
        echo ""
        echo "[!] Error de compilación detectado en $GO_DIR. Solicitando reparación..."
        echo ""
        PROMPT_REPARACION="Actúa como un Senior Go Developer. El código en $GO_DIR no compila tras los últimos cambios. Ejecuta 'go build ./...' en esa carpeta, identifica el error de compilación exacto, corrígelo en los archivos afectados y responde con una lista ultra-breve de la solución. Por economía de tokens, omite cualquier saludo o explicación extra."
        echo "$PROMPT_REPARACION" | copilot --allow-all 2>&1 | tee "$LOG_FILE"
    else
        git add .
        git commit -m "chore(spec): lote de sub-fases completado por AI (CLI)"
    fi
done

echo ""
echo "================================================================="
echo " ¡Todas las fases del spec.md fueron completadas y auditadas! "
echo "================================================================="
