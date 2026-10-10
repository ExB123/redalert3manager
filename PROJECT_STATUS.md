# Проверка исходных данных

- Формат исходного дампа: SQLite SQL (`PRAGMA foreign_keys=OFF`, `AUTOINCREMENT`), не PostgreSQL.
- SQL был успешно исполнен в SQLite, и локальная база `data/ra3-manager.sqlite` создана.
- В дампе 21 таблица.
- Записи: Team 32; Player 96; Match 256; RatingMatch 1732; Tournament 12; Season 10; RatingLeague 8; Map 16; MapStat 1043; Rank 24; Achievement 14; GameConfig 15; BackupLog 228; Mail 1064; Simulation 35.
- Некоторые таблицы пустые: Medal, News, WinnerPost, AchievementShowcase, `_AchievementToAchievementShowcase`.
- В `logoUrl` и других полях встречаются URL на домене Adaptive.ai. Их нужно будет перенести/заменить, чтобы приложение не зависело от этого хостинга.
- Эта сборка — начальный локальный каркас. Она не содержит авторизации, полноценных операций редактирования/удаления, всех экранов и готового публичного размещения.
