const STAGES = [
  {
    key: 'unripe',
    name: '단단해요 (Unripe)',
    badgeClass: 'bg-avocado-100 text-avocado-700',
    baseDays: 3,
    advice: '통풍이 잘 되는 곳에 두면 숙성이 진행돼요. 바나나와 함께 두면 더 빨리 익어요.',
    usage: ['아직 기다려주세요'],
  },
  {
    key: 'breaking',
    name: '익어가는 중 (Breaking)',
    badgeClass: 'bg-avocado-200 text-avocado-800',
    baseDays: 1.5,
    advice: '거의 다 됐어요. 빨리 먹을 계획이면 실온, 아니면 냉장으로 옮기세요.',
    usage: ['하루 더 기다렸다가 슬라이스'],
  },
  {
    key: 'ripe1',
    name: '적당히 익음 (Ripe)',
    badgeClass: 'bg-green-100 text-green-700',
    baseDays: 0,
    advice: '지금이 먹기 좋은 시점이에요. 아직 안 드실 거면 냉장 보관하세요.',
    usage: ['슬라이스', '토스트'],
  },
  {
    key: 'ripe2',
    name: '가장 잘 익음 (Ripe+)',
    badgeClass: 'bg-green-200 text-green-800',
    baseDays: 0,
    advice: '풍미가 가장 좋은 상태예요. 오늘 안에 드시는 걸 추천해요.',
    usage: ['슬라이스', '과카몰리', '토스트'],
  },
  {
    key: 'overripe',
    name: '너무 익음 (Overripe)',
    badgeClass: 'bg-amber-100 text-amber-800',
    baseDays: -1,
    advice: '갈변이 진행됐어요. 겉만 검다면 속을 확인하고, 무르거나 냄새가 나면 폐기하세요.',
    usage: ['과카몰리', '상태 확인 후 폐기'],
  },
];

const state = {
  photoDataUrl: null,
  storageFactor: 1,
  storageLabel: '실온 보관',
  storageType: 'room',
};

const $ = (id) => document.getElementById(id);

function showView(id) {
  ['view-upload', 'view-storage', 'view-result'].forEach((v) => {
    $(v).classList.toggle('hidden', v !== id);
    $(v).classList.toggle('flex', v === id);
  });
  $('backBtn').classList.toggle('invisible', id === 'view-upload');
}

function mockClassify() {
  const idx = Math.floor(Math.random() * STAGES.length);
  const confidence = Math.round(60 + Math.random() * 38);
  return { stage: STAGES[idx], confidence };
}

function computeTiming(stage, factor) {
  if (stage.baseDays === 0) return { label: '지금 드세요', tone: 'good' };
  if (stage.baseDays < 0) return { label: '이미 늦었어요', tone: 'warn' };
  const days = Math.max(1, Math.round(stage.baseDays * factor));
  return { label: `${days}일 뒤가 좋아요`, tone: 'wait' };
}

$('photoInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    state.photoDataUrl = reader.result;
    $('previewImg').src = reader.result;
    $('previewImg').classList.remove('hidden');
    $('dropZoneEmpty').classList.add('hidden');
    $('toStorageBtn').disabled = false;
  };
  reader.readAsDataURL(file);
});

$('toStorageBtn').addEventListener('click', () => showView('view-storage'));

document.querySelectorAll('.storage-option').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.storage-option').forEach((b) => {
      b.classList.remove('border-avocado-600', 'bg-avocado-50');
      b.classList.add('border-avocado-200');
      b.querySelector('.check').classList.add('hidden');
    });
    btn.classList.remove('border-avocado-200');
    btn.classList.add('border-avocado-600', 'bg-avocado-50');
    btn.querySelector('.check').classList.remove('hidden');
    state.storageFactor = parseFloat(btn.dataset.factor);
    state.storageLabel = btn.querySelector('span > span').textContent;
    state.storageType = btn.dataset.storage;
  });
});

$('toResultBtn').addEventListener('click', () => {
  const { stage, confidence } = mockClassify();
  const timing = computeTiming(stage, state.storageFactor);

  $('resultImg').src = state.photoDataUrl;
  $('stageBadge').textContent = stage.key.toUpperCase();
  $('stageBadge').className = `inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${stage.badgeClass}`;
  $('stageName').textContent = stage.name;
  $('confidenceBar').style.width = `${confidence}%`;
  $('confidenceText').textContent = `신뢰도 ${confidence}%`;

  const timingCard = $('timingCard');
  $('timingText').textContent = timing.label;
  timingCard.className = 'mt-4 rounded-2xl border-2 px-4 py-4 text-center ' +
    (timing.tone === 'good' ? 'border-green-300 bg-green-50 text-green-800' :
     timing.tone === 'warn' ? 'border-amber-300 bg-amber-50 text-amber-800' :
     'border-avocado-200 bg-avocado-50 text-avocado-800');

  $('storageAdvice').textContent = `${state.storageLabel} 기준 — ${stage.advice}`;

  $('usageTags').innerHTML = stage.usage
    .map((u) => `<span class="rounded-full bg-avocado-100 px-3 py-1 text-xs font-medium text-avocado-700">${u}</span>`)
    .join('');

  $('warningBanner').classList.toggle('hidden', confidence >= 70);

  showView('view-result');

  fetch('/api/judgments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      stage: stage.key,
      confidence,
      storageType: state.storageType,
      remainingLabel: timing.label,
    }),
  }).catch((err) => console.error('결과 저장 실패', err));
});

$('retakeBtn').addEventListener('click', () => {
  state.photoDataUrl = null;
  $('photoInput').value = '';
  $('previewImg').src = '';
  $('previewImg').classList.add('hidden');
  $('dropZoneEmpty').classList.remove('hidden');
  $('toStorageBtn').disabled = true;
  showView('view-upload');
});

$('backBtn').addEventListener('click', () => {
  const current = ['view-upload', 'view-storage', 'view-result'].find(
    (v) => !$(v).classList.contains('hidden')
  );
  if (current === 'view-result') showView('view-storage');
  else if (current === 'view-storage') showView('view-upload');
});

$('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.reload();
});

fetch('/api/me')
  .then((r) => r.json())
  .then(({ user }) => {
    if (!user) return;
    const displayName = user.name || user.email.split('@')[0];
    $('welcomeText').textContent = `${displayName}님 환영해요~ 저희 아보카도 맛있게 먹어보시죠? 드가를 드가~`;
    $('welcomeBanner').classList.remove('hidden');
    $('loginLink').classList.add('hidden');
  });
