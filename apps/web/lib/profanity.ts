const FORBIDDEN = [
  'puta', 'putita', 'putos', 'putazo',
  'mierda', 'cagada', 'cagon', 'caca',
  'culiao', 'culiados', 'culero', 'culo',
  'conchatumadre', 'concha', 'chucha',
  'pendejo', 'pendeja', 'pendejada',
  'maricon', 'marica', 'maricones',
  'gilipollas', 'gilipolla', 'tonto',
  'cabron', 'cabrones', 'cabronazo',
  'verga', 'pinga', 'pija', 'polla',
  'coger', 'cogerme', 'cogete', 'follar',
  'zorra', 'perra', 'perro',
  'estupido', 'estupida', 'idiota',
  'nazi', 'hitler', 'ku-klux', 'kkk',
  'fuck', 'shit', 'cunt', 'bitch', 'asshole',
  'nigger', 'nigga', 'faggot', 'fag', 'retard',
  'dick', 'cock', 'pussy', 'whore', 'slut',
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/@/g, 'a')
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/4/g, 'a')
    .replace(/\$/g, 's')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeClanName(name: string): string {
  return normalize(name);
}

export function containsProfanity(name: string): boolean {
  const n = normalize(name);
  return FORBIDDEN.some((word) => n.includes(word));
}

export function slugify(name: string): string {
  return normalize(name)
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}
