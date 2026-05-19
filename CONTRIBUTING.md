# Contribuyendo a Music Hub

¡Gracias por tu interés en contribuir! Aquí tienes las guías para hacerlo.

## Proceso

1. **Fork** el repositorio
2. **Crea una rama**: `git checkout -b feature/nombre-corto`
3. **Haz cambios** siguiendo las convenciones del proyecto
4. **Commit** usando [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` nueva funcionalidad
   - `fix:` corrección de bug
   - `docs:` cambios en documentación
   - `refactor:` mejora de código sin cambios funcionales
   - `chore:` cambios de infraestructura/build
5. **Push** a tu fork y abre un Pull Request

## Requisitos

### Backend
- Usar async/await para endpoints y DB
- Tipar correctamente con type hints de Python
- Pydantic v2 para schemas de validación
- Logging con loguru en vez de print

### Frontend
- TypeScript estricto
- CSS Modules para estilos de componentes
- Props tipadas con interfaces
- Custom hooks para lógica reutilizable
- `npm run typecheck` y `npm run lint` sin errores

## Testing

### Backend
```bash
cd backend
pytest -v
```

### Frontend
```bash
cd frontend
npx vitest run
```

## Pull Request Checklist
- [ ] El código compila sin errores
- [ ] Lint pasa (`npm run lint` o `ruff check .`)
- [ ] Typecheck pasa (`npm run typecheck` o `mypy .`)
- [ ] Tests existentes no se rompen
- [ ] Se añadieron tests para nuevas funcionalidades
