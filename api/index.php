<?php
declare(strict_types=1);

require_once __DIR__ . '/database.php';

function respond(int $status, array $data): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function body_json(): array
{
    $value = json_decode((string) file_get_contents('php://input'), true);
    if (!is_array($value)) respond(400, ['error' => 'بدنهٔ درخواست JSON معتبر نیست.']);
    return $value;
}

function decode_json(?string $value): mixed
{
    if ($value === null) return null;
    return json_decode($value, true, 512, JSON_THROW_ON_ERROR);
}

function referenced_assets(mixed $value, array &$ids): void
{
    if (!is_array($value)) return;
    if (isset($value['id'], $value['mime'], $value['width'], $value['height'], $value['size'])) {
        $ids[(string) $value['id']] = true;
    }
    foreach ($value as $child) referenced_assets($child, $ids);
}

function prune_assets(PDO $pdo): void
{
    $ids = [];
    foreach ($pdo->query('SELECT data FROM projects')->fetchAll(PDO::FETCH_COLUMN) as $json) {
        referenced_assets(decode_json((string) $json), $ids);
    }
    $brand = $pdo->query("SELECT setting_value FROM app_settings WHERE setting_key = 'brand'")->fetchColumn();
    if (is_string($brand)) referenced_assets(decode_json($brand), $ids);
    foreach ($pdo->query('SELECT id FROM assets')->fetchAll(PDO::FETCH_COLUMN) as $id) {
        if (!isset($ids[(string) $id])) {
            $delete = $pdo->prepare('DELETE FROM assets WHERE id = ?');
            $delete->execute([$id]);
        }
    }
}

try {
    $pdo = webzad_database();
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    if ($path === '/api/health' && $method === 'GET') {
        respond(200, ['ok' => true, 'database' => 'MySQL', 'version' => $pdo->query('SELECT VERSION()')->fetchColumn()]);
    }

    if ($path === '/api/bootstrap' && $method === 'GET') {
        $projects = [];
        foreach ($pdo->query('SELECT data FROM projects ORDER BY updated_at DESC')->fetchAll(PDO::FETCH_COLUMN) as $json) {
            $projects[] = decode_json((string) $json);
        }
        $settings = [];
        foreach ($pdo->query('SELECT setting_key, setting_value FROM app_settings')->fetchAll() as $row) {
            $settings[$row['setting_key']] = decode_json((string) $row['setting_value']);
        }
        $assetIds = $pdo->query('SELECT id FROM assets')->fetchAll(PDO::FETCH_COLUMN);
        respond(200, [
            'projects' => $projects,
            'brand' => $settings['brand'] ?? null,
            'activeProjectId' => $settings['active_project_id'] ?? null,
            'assetIds' => $assetIds,
        ]);
    }

    if ($path === '/api/sync' && $method === 'PUT') {
        $data = body_json();
        $project = $data['project'] ?? null;
        $brand = $data['brand'] ?? null;
        $activeId = $data['activeProjectId'] ?? null;
        if (!is_array($project) || !isset($project['id'], $project['name'], $project['updatedAt']) || !is_array($brand)) {
            respond(400, ['error' => 'اطلاعات پروژه یا برند معتبر نیست.']);
        }
        $projectJson = json_encode($project, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        $brandJson = json_encode($brand, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        $pdo->beginTransaction();
        try {
            $saveProject = $pdo->prepare('INSERT INTO projects (id, name, data, updated_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), data = VALUES(data), updated_at = VALUES(updated_at)');
            $saveProject->execute([(string) $project['id'], (string) $project['name'], $projectJson, max(0, (int) $project['updatedAt'])]);
            $saveBrand = $pdo->prepare("INSERT INTO app_settings (setting_key, setting_value) VALUES ('brand', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
            $saveBrand->execute([$brandJson]);
            if (is_string($activeId) && $activeId !== '') {
                $activeJson = json_encode($activeId, JSON_THROW_ON_ERROR);
                $saveActive = $pdo->prepare("INSERT INTO app_settings (setting_key, setting_value) VALUES ('active_project_id', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
                $saveActive->execute([$activeJson]);
            }
            $pdo->commit();
            prune_assets($pdo);
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
        respond(200, ['ok' => true]);
    }

    if ($path === '/api/active' && $method === 'PUT') {
        $data = body_json();
        if (!isset($data['id']) || !is_string($data['id'])) respond(400, ['error' => 'شناسهٔ پروژه معتبر نیست.']);
        $statement = $pdo->prepare("INSERT INTO app_settings (setting_key, setting_value) VALUES ('active_project_id', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
        $statement->execute([json_encode($data['id'], JSON_THROW_ON_ERROR)]);
        respond(200, ['ok' => true]);
    }

    if (preg_match('#^/api/assets/([a-zA-Z0-9_-]{1,120})$#', $path, $matches)) {
        $id = $matches[1];
        if ($method === 'HEAD' || $method === 'GET') {
            $statement = $pdo->prepare('SELECT mime, content, size FROM assets WHERE id = ?');
            $statement->execute([$id]);
            $asset = $statement->fetch();
            if (!$asset) respond(404, ['error' => 'تصویر در SQL پیدا نشد.']);
            header('Content-Type: ' . $asset['mime']);
            header('Content-Length: ' . $asset['size']);
            header('Cache-Control: private, max-age=3600');
            if ($method === 'GET') echo $asset['content'];
            exit;
        }
        if ($method === 'PUT') {
            $metadata = json_decode($_GET['meta'] ?? '', true);
            if (!is_array($metadata) || ($metadata['id'] ?? null) !== $id) respond(400, ['error' => 'مشخصات تصویر معتبر نیست.']);
            $mime = $metadata['mime'] ?? '';
            if (!in_array($mime, ['image/png', 'image/jpeg', 'image/webp'], true)) respond(415, ['error' => 'فرمت تصویر پشتیبانی نمی‌شود.']);
            $content = file_get_contents('php://input');
            $size = strlen($content);
            if ($size < 1 || $size > 40 * 1024 * 1024 || $size !== (int) ($metadata['size'] ?? 0)) {
                respond(413, ['error' => 'اندازهٔ تصویر با محدودیت یا مشخصات فایل هم‌خوانی ندارد.']);
            }
            foreach (['name', 'width', 'height'] as $field) {
                if (!isset($metadata[$field])) respond(400, ['error' => 'مشخصات تصویر کامل نیست.']);
            }
            $statement = $pdo->prepare('INSERT INTO assets (id, name, mime, width, height, size, content) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), mime = VALUES(mime), width = VALUES(width), height = VALUES(height), size = VALUES(size), content = VALUES(content)');
            $statement->bindValue(1, $id);
            $statement->bindValue(2, (string) $metadata['name']);
            $statement->bindValue(3, $mime);
            $statement->bindValue(4, max(1, (int) $metadata['width']));
            $statement->bindValue(5, max(1, (int) $metadata['height']));
            $statement->bindValue(6, $size, PDO::PARAM_INT);
            $statement->bindValue(7, $content, PDO::PARAM_LOB);
            $statement->execute();
            respond(200, ['ok' => true]);
        }
    }

    if (preg_match('#^/api/projects/([a-zA-Z0-9_-]{1,120})$#', $path, $matches) && $method === 'DELETE') {
        $statement = $pdo->prepare('DELETE FROM projects WHERE id = ?');
        $statement->execute([$matches[1]]);
        prune_assets($pdo);
        respond(200, ['ok' => true]);
    }

    respond(404, ['error' => 'مسیر API پیدا نشد.']);
} catch (Throwable $error) {
    error_log('[webzad-sql] ' . $error->getMessage());
    respond(500, ['error' => 'اتصال یا ذخیره‌سازی SQL ناموفق بود. تنظیمات MySQL را بررسی کنید.']);
}
