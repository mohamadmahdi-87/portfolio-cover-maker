<?php
declare(strict_types=1);

function portfolio_database(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;

    $localConfigPath = __DIR__ . '/config.local.php';
    $localConfig = is_file($localConfigPath) ? require $localConfigPath : [];
    if (!is_array($localConfig)) throw new RuntimeException('تنظیمات محلی MySQL معتبر نیست.');
    $host = getenv('PORTFOLIO_DB_HOST') ?: ($localConfig['host'] ?? '127.0.0.1');
    $port = getenv('PORTFOLIO_DB_PORT') ?: ($localConfig['port'] ?? '3306');
    $name = getenv('PORTFOLIO_DB_NAME') ?: ($localConfig['database'] ?? 'portfolio_cover');
    $user = getenv('PORTFOLIO_DB_USER') ?: ($localConfig['user'] ?? 'root');
    $password = getenv('PORTFOLIO_DB_PASSWORD') ?: ($localConfig['password'] ?? '');
    if (!preg_match('/^[a-zA-Z0-9_-]+$/', $name)) {
        throw new RuntimeException('نام پایگاه داده معتبر نیست.');
    }

    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];
    $server = new PDO("mysql:host={$host};port={$port};charset=utf8mb4", $user, $password, $options);
    $server->exec("CREATE DATABASE IF NOT EXISTS `{$name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo = new PDO("mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4", $user, $password, $options);
    $pdo->exec("CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR(120) NOT NULL PRIMARY KEY,
        name VARCHAR(180) NOT NULL,
        data JSON NOT NULL,
        updated_at BIGINT UNSIGNED NOT NULL,
        INDEX projects_updated_at (updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS app_settings (
        setting_key VARCHAR(64) NOT NULL PRIMARY KEY,
        setting_value JSON NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS assets (
        id VARCHAR(120) NOT NULL PRIMARY KEY,
        name VARCHAR(180) NOT NULL,
        mime VARCHAR(32) NOT NULL,
        width INT UNSIGNED NOT NULL,
        height INT UNSIGNED NOT NULL,
        size BIGINT UNSIGNED NOT NULL,
        content LONGBLOB NOT NULL,
        updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    return $pdo;
}
