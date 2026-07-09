@AGENTS.md

## Fluxo Git e GitHub

### Regras de Commit

**Todos os commits devem ser em Português Brasileiro**

Formato: `tipo(escopo): descrição em PT-BR`

Tipos:
- `feat:` nova funcionalidade
- `fix:` correção de bug
- `docs:` documentação
- `refactor:` refatoração (sem mudança de comportamento)
- `test:` testes
- `chore:` tarefas (deps, build, etc)

Exemplos:
```
feat: implementar tela de login com Google OAuth
fix: corrigir erro 404 na API de tarefas
docs: adicionar guia de configuração Supabase
```

### Workflow Git

1. **Editar código**
   ```bash
   # Verificar status
   git status
   ```

2. **Revisar mudanças**
   ```bash
   git diff
   ```

3. **Staging**
   ```bash
   # Arquivos específicos
   git add arquivo1.ts arquivo2.tsx
   
   # Ou tudo (cuidado com .env!)
   git add .
   ```

4. **Commit em PT-BR**
   ```bash
   git commit -m "feat: descrição clara em português"
   ```

5. **Push para GitHub**
   ```bash
   git push origin main
   ```

6. **Vercel Deploy** (automático)
   - Cada push em `main` dispara build + deploy no Vercel
   - Verificar status em vercel.com dashboard

### Boas Práticas

- Commits frequentes, pequenos e focused
- Mensagens descritivas (não "update", "fix stuff")
- Nunca commitar `.env` (gitignored)
- Revisar `git diff` antes de `git add` para evitar surpresas
- Pull antes de push se trabalhar em paralelo
