<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>ZapUPI HTML KIT</title>
  <script src="https://zapupi.com/single-html-web-kit.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"/>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:      #f4f6fb;
      --white:   #ffffff;
      --border:  #e4e8f0;
      --accent:  #3b6ef8;
      --green:   #16a34a;
      --red:     #dc2626;
      --yellow:  #d97706;
      --text:    #1a1a2e;
      --muted:   #6b7280;
      --mono:    'JetBrains Mono', monospace;
      --sans:    'Outfit', sans-serif;
      --radius:  12px;
    }

    html, body { min-height: 100vh; color: var(--text); font-family: var(--sans); }
    body { background: linear-gradient(135deg, #c7d7ff 0%, #dce6ff 40%, #c8edd8 100%); }

    .wrap { max-width: 560px; margin: 0 auto; padding: 40px 20px 60px; }

    /* ── Header ── */
    .header { display: flex; align-items: center; gap: 12px; margin-bottom: 32px; }
    .logo {
      width: 40px; height: 40px; border-radius: 10px;
      background: var(--accent); display: grid; place-items: center;
      font-size: 18px; flex-shrink: 0; color: #fff;
    }
    .header h1 { font-size: 20px; font-weight: 800; }
    .header h1 span { color: var(--accent); }
    .header p { font-size: 12px; color: var(--muted); margin-top: 1px; }

    /* ── Tabs ── */
    .tabs { display: flex; gap: 4px; background: var(--border); border-radius: 10px; padding: 3px; margin-bottom: 24px; }
    .tab {
      flex: 1; padding: 9px 0; border: none; border-radius: 8px;
      font-family: var(--sans); font-size: 13.5px; font-weight: 600;
      cursor: pointer; transition: all .18s; color: var(--muted); background: transparent;
      display: flex; align-items: center; justify-content: center; gap: 7px;
    }
    .tab.active { background: var(--white); color: var(--text); box-shadow: 0 1px 6px rgba(0,0,0,.08); }
    .tab i { font-size: 12px; }

    /* ── Card ── */
    .card { background: var(--white); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; }

    /* ── Panel ── */
    .panel { display: none; }
    .panel.active { display: block; }

    /* ── Field ── */
    .field { margin-bottom: 14px; }
    .field label {
      display: flex; justify-content: space-between; align-items: center;
      font-size: 11px; font-weight: 700; letter-spacing: .5px;
      text-transform: uppercase; color: var(--muted); margin-bottom: 6px;
    }
    .opt { font-size: 10px; color: #aab; text-transform: none; letter-spacing: 0; font-weight: 400; }
    .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

    .inp-wrap { position: relative; }
    .inp-wrap .pfx {
      position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
      font-family: var(--mono); font-size: 13px; color: var(--green);
      pointer-events: none; font-weight: 600;
    }
    input {
      width: 100%; background: var(--bg); border: 1px solid var(--border);
      border-radius: 8px; padding: 10px 12px; color: var(--text);
      font-size: 14px; font-family: var(--sans); outline: none;
      transition: border-color .18s, box-shadow .18s;
    }
    .inp-wrap.pfxed input { padding-left: 24px; }
    input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(59,110,248,.1); background: #fff; }
    input::placeholder { color: #c0c4cc; }

    /* Order ID row */
    .oid-row { display: flex; gap: 6px; }
    .oid-row input { flex: 1; }
    .regen {
      width: 40px; border: 1px solid var(--border); border-radius: 8px;
      background: var(--bg); color: var(--accent); font-size: 13px;
      cursor: pointer; display: grid; place-items: center; transition: all .18s; flex-shrink: 0;
    }
    .regen:hover { border-color: var(--accent); background: #eef2ff; }

    /* ── Buttons ── */
    .btn {
      width: 100%; padding: 12px; margin-top: 4px; border: none; border-radius: 9px;
      font-family: var(--sans); font-size: 14px; font-weight: 700;
      cursor: pointer; transition: opacity .15s, transform .15s;
      display: flex; align-items: center; justify-content: center; gap: 8px;
    }
    .btn:hover { opacity: .88; transform: translateY(-1px); }
    .btn:active { transform: translateY(0); }
    .btn:disabled { opacity: .4; cursor: not-allowed; transform: none; }
    .btn-blue  { background: var(--accent); color: #fff; }
    .btn-green { background: #16a34a; color: #fff; }

    /* ── Details page ── */
    .det-page {
      display: none; position: fixed; inset: 0; z-index: 8000;
      background: var(--bg); overflow-y: auto;
    }
    .det-page.show { display: block; }
    .det-inner { max-width: 560px; margin: 0 auto; padding: 28px 20px 60px; }

    .det-hdr { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
    .back {
      width: 36px; height: 36px; border-radius: 8px; border: 1px solid var(--border);
      background: var(--white); font-size: 14px; cursor: pointer;
      display: grid; place-items: center; color: var(--text); transition: all .18s; flex-shrink: 0;
    }
    .back:hover { border-color: var(--accent); color: var(--accent); }
    .det-hdr-title { font-size: 17px; font-weight: 800; }
    .det-hdr-sub { font-size: 11px; color: var(--muted); font-family: var(--mono); margin-top: 2px; }

    /* Hero */
    .hero {
      background: var(--white); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 24px 20px; text-align: center; margin-bottom: 16px;
    }
    .hero-icon { font-size: 36px; margin-bottom: 10px; }
    .hero-icon i { }
    .hero-status { font-size: 18px; font-weight: 800; margin-bottom: 4px; }
    .hero-amount { font-size: 32px; font-weight: 800; font-family: var(--mono); margin: 8px 0 2px; }
    .clr-green  { color: var(--green); }
    .clr-red    { color: var(--red); }
    .clr-yellow { color: var(--yellow); }
    .clr-blue   { color: var(--accent); }

    /* Info card */
    .icard { background: var(--white); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; margin-bottom: 12px; }
    .icard-ttl {
      padding: 10px 16px; font-size: 10px; font-weight: 700; letter-spacing: .8px;
      text-transform: uppercase; color: var(--muted); border-bottom: 1px solid var(--border);
      background: var(--bg); display: flex; align-items: center; gap: 7px;
    }
    .irow {
      display: flex; justify-content: space-between; align-items: flex-start;
      padding: 11px 16px; border-bottom: 1px solid var(--border); gap: 14px;
    }
    .irow:last-child { border-bottom: none; }
    .ilbl { font-size: 12px; color: var(--muted); font-weight: 500; flex-shrink: 0; }
    .ival { font-size: 12.5px; font-family: var(--mono); color: var(--text); text-align: right; word-break: break-all; }

    .tag-row { display: flex; gap: 5px; flex-wrap: wrap; justify-content: flex-end; }
    .tag {
      padding: 2px 9px; border-radius: 20px; font-size: 11px;
      background: #eef2ff; color: var(--accent); border: 1px solid #c7d4fd;
      font-family: var(--sans);
    }
  </style>
</head>
<body>

<!-- Details Page -->
<div class="det-page" id="det-page">
  <div class="det-inner" id="det-inner"></div>
</div>

<div class="wrap">

  <div class="header">
    <div class="logo"><i class="fa-solid fa-bolt"></i></div>
    <div>
      <h1>Zap<span>UPI</span></h1>
      <p>Developer Console</p>
    </div>
  </div>

  <div class="tabs">
    <button class="tab active" id="tab-c" onclick="switchTab('c')">
      <i class="fa-solid fa-plus"></i> Create Order
    </button>
    <button class="tab" id="tab-s" onclick="switchTab('s')">
      <i class="fa-solid fa-magnifying-glass"></i> Order Status
    </button>
  </div>

  <!-- Card -->
  <div class="card">

    <!-- Create Order -->
    <div class="panel active" id="panel-c">

      <div class="field">
        <label>Zap Key</label>
        <input id="c-key" type="text" placeholder="zap••••••••••••••"/>
      </div>

      <div class="field">
        <label>Order ID <span class="opt">auto-generated</span></label>
        <div class="oid-row">
          <input id="c-oid" type="text" placeholder="ORD…"/>
          <button class="regen" onclick="regenOid()" title="Regenerate">
            <i class="fa-solid fa-rotate-right"></i>
          </button>
        </div>
      </div>

      <div class="row2">
        <div class="field">
          <label>Amount</label>
          <div class="inp-wrap pfxed">
            <span class="pfx">₹</span>
            <input id="c-amt" type="number" placeholder="0.00" min="1" step="any"/>
          </div>
        </div>
        <div class="field">
          <label>Mobile <span class="opt">optional</span></label>
          <input id="c-mob" type="tel" placeholder="9876543210" maxlength="10"/>
        </div>
      </div>

      <div class="field">
        <label>Remark <span class="opt">optional</span></label>
        <input id="c-rem" type="text" placeholder="R1 | R2 | R3"/>
      </div>

      <button class="btn btn-blue" id="c-btn" onclick="doCreate()">
        <i class="fa-solid fa-bolt"></i> Create Order &amp; Pay
      </button>
    </div>

    <!-- Order Status -->
    <div class="panel" id="panel-s">

      <div class="field">
        <label>Zap Key</label>
        <input id="s-key" type="text" placeholder="zap••••••••••••••"/>
      </div>

      <div class="field">
        <label>Order ID</label>
        <input id="s-oid" type="text" placeholder="ORD…"/>
      </div>

      <button class="btn btn-green" id="s-btn" onclick="doStatus()">
        <i class="fa-solid fa-magnifying-glass"></i> Check Status
      </button>
    </div>

  </div>
</div>

<script>
var _zapKey = null;

/* ── Tabs ── */
function switchTab(t) {
  ['c','s'].forEach(function(x) {
    document.getElementById('tab-'+x).classList.toggle('active', x===t);
    document.getElementById('panel-'+x).classList.toggle('active', x===t);
  });
}

/* ── Order ID ── */
function regenOid() { document.getElementById('c-oid').value = 'ORD' + Date.now(); }
window.addEventListener('DOMContentLoaded', regenOid);

/* ── SweetAlert helpers ── */
var SA = {
  loading: function(title, msg) {
    Swal.fire({
      title: title, html: msg || '',
      allowOutsideClick: false, showConfirmButton: false,
      didOpen: function() { Swal.showLoading(); }
    });
  },
  result: function(status, orderId) {
    var cfg = {
      success: { icon:'success', title:'Payment Successful', btnColor:'#16a34a' },
      failed:  { icon:'error',   title:'Payment Failed',     btnColor:'#dc2626' },
      timeout: { icon:'warning', title:'Payment Timeout',    btnColor:'#d97706' },
    }[status] || { icon:'info', title: status, btnColor:'#3b6ef8' };

    Swal.fire({
      icon: cfg.icon,
      title: cfg.title,
      html: '<span style="font-family:monospace;font-size:13px;color:#555">' + orderId + '</span>',
      showCancelButton: true,
      cancelButtonText: 'Cancel',
      confirmButtonText: 'Full View',
      confirmButtonColor: cfg.btnColor,
      cancelButtonColor: '#6b7280',
      reverseButtons: true,
    }).then(function(r) {
      if (r.isConfirmed) fetchDetails(orderId);
    });
  },
  error: function(msg) {
    Swal.fire({ icon:'error', title:'Error', text: msg, confirmButtonColor:'#3b6ef8' });
  }
};

/* ── ZapUPI Callbacks ── */
ZapUPI.setPaymentCallbacks({
  onSuccess: function(id) { SA.result('success', id); },
  onFailed:  function(id) { SA.result('failed',  id); },
  onTimeout: function(id) { SA.result('timeout', id); },
});

/* ── Create Order ── */
function doCreate() {
  var key = document.getElementById('c-key').value.trim();
  var oid = document.getElementById('c-oid').value.trim();
  var amt = document.getElementById('c-amt').value.trim();
  var mob = document.getElementById('c-mob').value.trim();
  var rem = document.getElementById('c-rem').value.trim();

  if (!key) { SA.error('Zap Key required'); return; }
  if (!oid) { SA.error('Order ID required'); return; }
  if (!amt || isNaN(amt) || Number(amt) <= 0) { SA.error('Valid amount enter karo'); return; }

  _zapKey = key;
  document.getElementById('c-btn').disabled = true;
  SA.loading('Creating Order…', 'ZapUPI gateway se connect ho raha hai');

  ZapUPI.createOrder(
    { zap_key: key, order_id: oid, amount: amt, customer_mobile: mob, remark: rem },
    {
      onResponse: function(url, rid) {
        document.getElementById('c-btn').disabled = false;
        Swal.close();
        ZapUPI.loadPayment(url);
        regenOid();
      },
      onError: function(err) {
        document.getElementById('c-btn').disabled = false;
        SA.error(err);
      }
    }
  );
}

/* ── Order Status ── */
function doStatus() {
  var key = document.getElementById('s-key').value.trim();
  var oid = document.getElementById('s-oid').value.trim();
  if (!key) { SA.error('Zap Key required'); return; }
  if (!oid) { SA.error('Order ID required'); return; }
  _zapKey = key;
  fetchDetails(oid);
}

/* ── Fetch & Show Details ── */
function fetchDetails(oid) {
  if (!_zapKey) { SA.error('Zap Key missing'); return; }
  SA.loading('Fetching Details…', oid);

  ZapUPI.orderStatus(
    { zap_key: _zapKey, order_id: oid },
    {
      onResponse: function(id, data) { Swal.close(); showDetails(data); },
      onError:    function(err)      { SA.error(err); }
    }
  );
}

/* ── Details Page ── */
function showDetails(res) {
  var d  = res.data || {};
  var st = (d.status || '').toLowerCase();

  /* Icon per status */
  var iconHtml = {
    success: '<i class="fa-solid fa-circle-check" style="color:var(--green)"></i>',
    failed:  '<i class="fa-solid fa-circle-xmark" style="color:var(--red)"></i>',
    pending: '<i class="fa-solid fa-clock" style="color:var(--yellow)"></i>',
  }[st] || '<i class="fa-solid fa-circle-question" style="color:var(--muted)"></i>';

  var clr = { success:'clr-green', failed:'clr-red', pending:'clr-yellow' }[st] || '';
  var amt = d.amount != null ? '₹' + parseFloat(d.amount).toFixed(2) : '—';

  function row(lbl, val, cls) {
    return '<div class="irow"><span class="ilbl">'+lbl+'</span><span class="ival '+(cls||'')+'">'+( val||'—')+'</span></div>';
  }

  var tags = '';
  if (Array.isArray(d.remark_array) && d.remark_array.length) {
    tags = '<div class="irow"><span class="ilbl">Split</span><div class="tag-row">' +
      d.remark_array.map(function(r){ return '<span class="tag">'+esc(r)+'</span>'; }).join('') +
      '</div></div>';
  }

  var html =
    '<div class="det-hdr">' +
      '<button class="back" onclick="closeDetails()"><i class="fa-solid fa-arrow-left"></i></button>' +
      '<div>' +
        '<div class="det-hdr-title">Order Details</div>' +
        '<div class="det-hdr-sub">'+esc(d.order_id||'')+'</div>' +
      '</div>' +
    '</div>' +

    '<div class="hero">' +
      '<div class="hero-icon">'+iconHtml+'</div>' +
      '<div class="hero-status '+clr+'">'+esc(d.status||'')+'</div>' +
      '<div class="hero-amount">'+amt+'</div>' +
    '</div>' +

    '<div class="icard">' +
      '<div class="icard-ttl"><i class="fa-solid fa-receipt"></i> Transaction</div>' +
      row('Order ID',   esc(d.order_id),  'clr-blue') +
      row('TXN ID',     esc(d.txn_id),    'clr-blue') +
      row('UTR',        d.utr ? esc(d.utr) : '<span style="color:#bbb">—</span>') +
      row('Status',     esc(d.status),    clr) +
      row('Created At', esc(d.create_at)) +
    '</div>' +

    '<div class="icard">' +
      '<div class="icard-ttl"><i class="fa-solid fa-user"></i> Customer</div>' +
      row('Mobile', esc(d.custumer_mobile)) +
      '<div class="irow"><span class="ilbl">Remark</span><span class="ival">'+esc(d.remark||'—')+'</span></div>' +
      tags +
    '</div>';

  document.getElementById('det-inner').innerHTML = html;
  document.getElementById('det-page').classList.add('show');
}

function closeDetails() {
  document.getElementById('det-page').classList.remove('show');
}

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
</script>
</body>
</html>