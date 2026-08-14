insert into ajustes (id) values (true) on conflict do nothing;

insert into productos (nombre, emoji, precio, orden) values
  ('Base neutra',        null, 20000,  1),
  ('Vainilla',          '🌸', 22000, 10),
  ('Fresa',             '🍓', 22000, 11),
  ('Arequipe',          '🍬', 22000, 12),
  ('Chocolate',         '🍫', 22000, 13),
  ('Yogurt tradicional','🥤', 22000, 14),
  ('Frutos Rojos',      '🍎', 22000, 15),
  ('Frutos Morados',    '🍇', 22000, 16),
  ('Ron pasas',         '🍹', 22000, 17),
  ('Coco',              '🥥', 22000, 18),
  ('Mandarina',          null, 22000, 19),
  ('Maracuyá',          '🍊', 25000, 30),
  ('Frutos Amarillos',   null, 25000, 31),
  ('Yogurt Premium',     null, 25000, 32),
  ('Chicle Blue Ice',    null, 25000, 33),
  ('Kiwi',               null, 25000, 34),
  ('Café',               null, 25000, 35),
  ('Milo',               null, 28000, 40),
  ('4 Leches',           null, 28000, 41),
  ('Nucita',             null, 28000, 42),
  ('Postre de Nata',    '🐄', 28000, 43);
