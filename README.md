Réplica web do programa [Arronax](https://github.com/loplex/arronax), desenvolvido para centralizar a administração de atalhos, pois o original suporta somente a edição de um único registro por vez, e a sincronização entre os diretórios root (`/usr/share/applications`) e do usuário (`~/.local/share/applications`) precisa ser mantida manualmente.

Esta versão foi adaptada para rodar usando arquivos locais copiados do sistema, pois não funcionaria nativamente no Windows.
## 📁 Estrutura do Projeto

O projeto é dividido em três partes principais:
1. **`frontend/`**: Interface do usuário desenvolvida em React + Vite.
2. **`backend/`**: Servidor Node.js + Express que gerencia as operações de CRUD, leitura/escrita de arquivos `.desktop` e sincronização.
3. **`database.sql`**: Script para a criação do banco de dados e da tabela correspondente no MySQL.

---

## 🛠️ Pré-requisitos

Antes de iniciar, certifique-se de ter instalados em sua máquina:
- **Node.js** (versão 18 ou superior)
- **npm** (gerenciador de pacotes do Node.js)
- **MySQL / MariaDB**

---

## 🚀 Instalação e Execução

### Passo 1: Configuração do Banco de Dados (MySQL)

1. Abra o terminal ou uma ferramenta gráfica do MySQL (como o DBeaver ou o MySQL Workbench).
2. Importe o arquivo `database.sql` localizado na raiz do projeto:
   ```bash
   mysql -u root -p < database.sql
   ```
   *Nota: Caso o seu usuário do MySQL não possua senha (que por padrão é o caso), execute:*
   ```bash
   mysql -u root < database.sql
   ```

3. Isso criará o banco de dados `entry_editor_db` e a tabela `desktop_entries` com alguns dados iniciais para teste.

### Passo 2: Inicialização do Backend

1. Navegue até o diretório do backend:
   ```bash
   cd backend
   ```
2. Instale as dependências necessárias:
   ```bash
   npm install
   ```
3. Configure o arquivo `.env` (se necessário). Um arquivo `.env.example` está disponível para referência. Por padrão, ele está configurado da seguinte forma:
   ```env
   PORT=5000
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=entry_editor_db
   ```

4. Execute o servidor em modo de desenvolvimento:
   ```bash
   npm run dev
   ```
   O backend estará disponível em `http://localhost:5000`.

### Passo 3: Inicialização do Frontend

1. Navegue até o diretório do frontend:
   ```bash
   cd ../frontend
   ```
2. Instale as dependências necessárias:
   ```bash
   npm install
   ```
3. Inicie o servidor de desenvolvimento do Vite:
   ```bash
   npm run dev
   ```
4. O frontend estará disponível em `http://localhost:5173`. Acesse essa URL no seu navegador para utilizar o sistema.

---

## 🌟 Funcionalidades do Sistema

- **CRUD Completo de Atalhos**:
  - **Criação**: Adicione novos atalhos configurando nome, comando, descrição, ícone, categorias, tipos mime, etc.
  - **Leitura/Listagem**: Navegue pelos atalhos com suporte a paginação, busca dinâmica (por nome, descrição ou comando) e filtro por categoria.
  - **Edição**: Altere os dados de um atalho existente.
  - **Exclusão**: Remova o atalho do banco de dados e delete o arquivo `.desktop` do disco.
- **Visualização Detalhada**: Veja todas as informações estruturadas de uma entrada, além de uma simulação do código-fonte do arquivo `.desktop`.
- **Seleção e Ações em Massa (Bulk Operations)**:
  - Selecione vários itens na listagem para realizar **edição em massa** (alterar categorias, tipo de atalho, executar no terminal ou notificação) ou **exclusão em massa**.
- **Escolha Dinâmica de Ícone (Icon Picker)**:
  - Um modal com pesquisa dinâmica integrada que lê e serve ícones diretamente do sistema de arquivos local.
- **Sincronização Bidirecional**:
  - O sistema sincroniza automaticamente os arquivos físicos da pasta `applications/` para o banco de dados na inicialização, e oferece um botão de sincronização manual na interface.
