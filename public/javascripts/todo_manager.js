const TodoManager = (function() {
  let _todoList = new WeakMap();

  class TodoManager {
    constructor(todos) {
      _todoList.set(this, todos);
    }

    allTodos(){
      const todoList = _todoList.get(this);
      const completed = this.completedTodos();
      const uncompleted = todoList.matchingTodos( {completed: false });

      return uncompleted.concat(completed);
    }

    completedTodos() {
      const todoList = _todoList.get(this);
      return todoList.matchingTodos( {completed: true });
    }

    todosInMonthYear(month, year) {
      return this.allTodos()
                 .filter(todo => todo.isWithinMonthYear(month, year));
    }

    completedTodosInMonthYear(month, year) {
      return this.completedTodos()
                 .filter(todo => todo.isWithinMonthYear(month, year));
    }
  }

  return TodoManager;
}());

const TodoList = (function() {
  const _todos = new WeakMap();
  const _createTodo = new WeakMap();
  const _createCopy = new WeakMap();

  class TodoList {
    constructor(todoList) {
      _todos.set(this.constructor, []);

      _createTodo.set(this.constructor, function(props) {
        return new Todo(props);
      });

      _createCopy.set(this.constructor, todos => {
        const createTodo = _createTodo.get(this.constructor);
        const shallowCopy = [];
        todos.forEach(todo => {
          let copied = Object.assign({}, todo);
          shallowCopy.push(copied);
        });

        return shallowCopy.map(props => createTodo(props));
      });

      const todos = _todos.get(this.constructor);
      const createTodo = _createTodo.get(this.constructor);

      todoList.forEach(props => todos.push(createTodo(props)));
    }

    addTodo(todoProps) {
      const createTodo = _createTodo.get(this.constructor);
      const todos = _todos.get(this.constructor);

      todos.push(createTodo(todoProps));
      return this;
    }

    deleteTodo(id) {
      const todos = _todos.get(this.constructor);
      let matchingTodo = todos.filter(todo => todo.id === id).pop();

      if(matchingTodo) {
        todos.splice(todos.indexOf(matchingTodo), 1);
      }
    }

    update(id, newProps) {
      const todos = _todos.get(this.constructor);

      const propNames = Object.keys(newProps);
      const matchingTodo = todos.filter(todo => todo.id === id).pop();

      if(matchingTodo) {
        propNames.forEach(propName => {
          if(matchingTodo.hasOwnProperty(propName)) {
            matchingTodo[propName] = newProps[propName];
          }
        });
      }

      return this;
    }

    matchingTodos(props) {
      const todos = _todos.get(this.constructor);
      const createCopy = _createCopy.get(this.constructor);

      const propNames = Object.keys(props);

      const matching = todos.filter(todo => {
        return propNames.every(propName => props[propName] === todo[propName]);
      });

      return createCopy(matching);
    }
  }

  return TodoList;
}());

const Todo = (function() {
  const _idNum = new WeakMap();
  const _completed = new WeakMap();
  const _assignId = new WeakMap();

  class Todo {
    constructor(props) {
      _assignId.set(this.constructor, () => {
        if (_idNum.get(this.constructor)) {
          _idNum.set(this.constructor, _idNum.get(this.constructor) + 1);
        } else {
          _idNum.set(this.constructor, 1)
        }

        return _idNum.get(this.constructor);
      });

      const assignId = _assignId.get(this.constructor);

      _completed.set(this.constructor, false);
      const completed = _completed.get(this.constructor);

      if (props.id === undefined) {
        this.id = assignId();
      }

      if (props.completed === undefined) {
        this.completed = completed;
      }

      return Object.assign(this, props);
    }

    isWithinMonthYear(month, year) {
      return this.month === month && this.year === year;
    }
  }

  return Todo;
}());

class DatabasePersistence {
  constructor() {
    this.findAllAction = "/api/todos";
    this.addTodoAction = "/api/todos";
    this.deleteTodoAction = "/api/todos/"
  }

  findAllTodos() {
   return new Promise(resolve => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", this.findAllAction);
    xhr.responseType = 'json';
    xhr.onload = () => resolve(xhr.response);
    xhr.send();
   });
 }

  add(props) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", this.addTodoAction);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.responseType = 'json';
      xhr.onload = () => {
        switch (xhr.status) {
          case 201:
            resolve(xhr.response);
            break;
          case 400:
            reject(xhr.response);
            break;
        }
      }
      xhr.send(JSON.stringify(props));
    });
  }

  update(id, props) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', `/api/todos/${id}`);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.responseType = 'json';
      xhr.onload = () => {
        switch(xhr.status) {
          case 201:
            resolve(xhr.response);
            break;
          case 400:
            reject(xhr.responseText);
            break;
        }
      }
      xhr.send(JSON.stringify(props));
    })
  }

  deleteTodo(id) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('DELETE', this.deleteTodoAction + id);
      xhr.onload = () => {
        switch (xhr.status) {
          case 204:
            resolve();
            break;
          case 400:
            reject(xhr.responseText);
            break;
        }
      }
      xhr.send();
    });
  }

  toggleTodo(id) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/todos/${id}/toggle_completed`);
      xhr.responseType = 'json';
      xhr.onload = () => {
        switch(xhr.status) {
          case 201:
            resolve(xhr.response);
            break;
          case 400:
            reject(xhr.responseText);
            break;
        }
      }
      xhr.send();
    });
  }
}

class Modal {
  constructor(template) {
    this.node = this.createNode(template)
    this.title = this.node.querySelector('input[id="title"]');
    this.day = this.node.querySelector('select[name="day"]');
    this.month = this.node.querySelector('select[name="month"]');
    this.year = this.node.querySelector('select[name="year"]');
    this.description = this.node.querySelector('textarea');
  }

  createNode(template) {
    const holder = document.createElement('div');
    holder.innerHTML = template({});
    const node = holder.firstElementChild;
    node.setAttribute('data-action', 'add');
    node.classList.add('hidden');
    document.querySelector('main').appendChild(node);
    return node;
  }

  reset() {
    this.node.reset();
    this.node.setAttribute('data-action', 'add');
    this.node.removeAttribute('data-id');
    this.node.classList.add('fade-out');
    setTimeout(() => this.node.classList.add('hidden'), 600)

  }

  update(todo) {
    if (todo.title) this.title.value = todo.title;
    if (todo.day) this.day.value = todo.day;
    if (todo.month) this.month.value = todo.month;
    if (todo.year) this.year.value = todo.year;
    if (todo.description) this.description.value = todo.description;
    this.node.setAttribute('data-action', 'update')
    this.node.setAttribute('data-id', todo.id);
    this.node.setAttribute('data-completed', todo.completed);
  }

  show() {
    this.node.classList.add('fade-in');
    this.node.classList.remove('fade-out');
    this.node.classList.remove('hidden');
  }

  action() {
    return this.node.getAttribute('data-action');
  }

  isForNewTodo() {
    return this.action() === 'add';
  }

  id() {
    return this.node.getAttribute('data-id');
  }

  completed() {
    return this.node.getAttribute('data-completed');
  }
}

// class SummaryList {
//   constructor(node, template) {
//     this.node = node;
//     this.template = template;
//   }

//   refresh(todos) {
//     this.node.innerHTML = this.template({ todos: todos });
//   }

//   listItems() {
//     return this.node.querySelectorAll('li');
//   }
// }

class Nav {
  constructor(node, template) {
    this.node = node;
    this.template = template;
    this.highlighted = 'All Todos';
    this.activeSection = 'all';
  }

  refresh(todos) {
    this.node.innerHTML = this.template({ todos: todos })
  }

  listItems() {
    return this.node.querySelectorAll('li');
  }

  updateAllTodosCounter(count) {
    this.node.querySelector('section.all-todos span.highlighted').textContent = count;
  }

  updateCompletedTodosCounter(count) {
    this.node.querySelector('section.completed span.highlighted').textContent = count;
  }

  allTodosDates() {
    return Array.from(this.node.querySelectorAll('section.all-todos li')).slice(1);
  }

  completedTodosDates() {
    return Array.from(this.node.querySelectorAll('section.completed li')).slice(1);
  }

  dateListItems() {
    return this.allTodosDates().concat(this.completedTodosDates());
  }

  resetHighlight() {
    this.highlighted = 'All Todos';
    this.activeSection = 'all';
  }

  highlight() {
    const lis = Array.from(this.node.querySelectorAll(`li[data-section="${this.activeSection}"]`))
    const filtered = lis.filter(node => node.firstElementChild.getAttribute('data-title') === this.highlighted)[0]
    filtered.classList.add('highlighted');

  }
}