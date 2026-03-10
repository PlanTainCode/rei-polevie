#!/bin/bash
set -e
set -o pipefail

export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"

FLAVOR="${1:-local}"
BUILD_TYPE="${2:-debug}"

# Опция: третий аргумент "clean" — полная пересборка (нужно при смене иконки и т.п.)
if [ "${3:-}" = "clean" ]; then
    echo "-> Очистка..."
    ./gradlew clean --daemon
fi

echo "=== Полевие Mobile ==="
echo "Flavor: $FLAVOR, Build type: $BUILD_TYPE"
echo ""

# debug -> Debug, release -> Release (portable, т.к. BSD sed на Mac не поддерживает \u)
BUILD_TYPE_CAP="$(echo "${BUILD_TYPE:0:1}" | tr '[:lower:]' '[:upper:]')${BUILD_TYPE:1}"
VARIANT="${FLAVOR}${BUILD_TYPE_CAP}"

echo "-> Сборка APK ($VARIANT)..."
if ! ./gradlew "assemble${VARIANT}" --daemon 2>&1; then
    echo ""
    echo "=== Ошибка сборки ==="
    exit 1
fi

APK_DIR="app/build/outputs/apk/${FLAVOR}/${BUILD_TYPE}"
APK_FILE=$(ls -t ${APK_DIR}/*.apk 2>/dev/null | head -1)

if [ -z "$APK_FILE" ]; then
    echo "ОШИБКА: APK не найден в $APK_DIR"
    exit 1
fi

echo "-> APK готов: $APK_FILE"
echo "-> Размер: $(du -h "$APK_FILE" | cut -f1)"

DEVICE_COUNT=$(adb devices | grep -c "device$" || true)
if [ "$DEVICE_COUNT" -eq 0 ]; then
    echo ""
    echo "ВНИМАНИЕ: Устройство не подключено."
    echo "Подключите телефон по USB (с включенной отладкой по USB) и запустите снова."
    echo ""
    echo "APK для ручной установки: $APK_FILE"
    exit 0
fi

echo "-> Установка на устройство..."
adb install -r "$APK_FILE"
echo "-> Запуск приложения..."
adb shell am start -n "ru.polevie.mobile${FLAVOR:+.${FLAVOR}}/ru.polevie.mobile.MainActivity"

echo ""
echo "=== Готово! ==="
