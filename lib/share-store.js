export const ID_PATTERN = /^[A-Za-z0-9_-]{8}$/;

function redisConfig() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('공유 저장소가 연결되지 않았습니다.');
  return { url, token };
}

export async function redis(command) {
  const { url, token } = redisConfig();
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  if (!response.ok) throw new Error(`저장소 응답 오류: ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

export async function readLetter(id) {
  if (!ID_PATTERN.test(id)) return { status: 400, letter: null };
  const result = await redis(['GET', `letter:${id}`]);
  if (!result) return { status: 404, letter: null };
  try { return { status: 200, letter: JSON.parse(result) }; }
  catch { return { status: 500, letter: null }; }
}
