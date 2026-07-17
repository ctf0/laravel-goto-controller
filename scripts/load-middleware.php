require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make('Illuminate\\Contracts\\Console\\Kernel')->bootstrap();
$items = [];
$middleware = array_merge(
    app('Illuminate\\Contracts\\Http\\Kernel')->getMiddlewareGroups(),
    app('router')->getMiddleware(),
);
foreach ($middleware as $name => $classes) {
    $items[$name] = [];
    foreach ((array) $classes as $class) {
        if (!is_string($class) || !class_exists($class)) {
            continue;
        }
        $reflection = new ReflectionClass($class);
        $method = $reflection->hasMethod('__invoke')
            ? $reflection->getMethod('__invoke')
            : $reflection->getMethod('handle');
        $items[$name][] = [
            'class' => $class,
            'path' => $reflection->getFileName(),
            'line' => $method->getStartLine(),
        ];
    }
}
echo json_encode($items);
