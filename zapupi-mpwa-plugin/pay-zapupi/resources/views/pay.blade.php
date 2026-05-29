<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ __('ZapUPI Payment') }}</title>
</head>
<body>
<script>
    // Redirect to ZapUPI payment page in same tab
    window.location.href = "{{ $paymentUrl }}";
</script>
</body>
</html>
