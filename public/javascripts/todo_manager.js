"use strict"

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
  }

  findAllTodos() {
    return fetch("/api/todos", {
      method: "GET"
    });
 }

  add(props) {
    return fetch("/api/todos", {
      method: "POST",
      body: JSON.stringify(props),
      headers: { 'Content-Type': 'application/json' }
    });
  }

  update(id, props) {
    return fetch(`/api/todos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(props),
      headers: { 'Content-Type': 'application/json' }
    });
  }

  deleteTodo(id) {
    return fetch(`/api/todos/${id}`, {
      method: 'DELETE',
    });
  }

  toggleTodo(id) {
    return fetch(`/api/todos/${id}/toggle_completed`, {
      method: 'POST',
    });
  }
}

class Modal {
  constructor(node) {
    this.node = node;
    this.title = this.node.querySelector('input[id="title"]');
    this.day = this.node.querySelector('select[name="day"]');
    this.month = this.node.querySelector('select[name="month"]');
    this.year = this.node.querySelector('select[name="year"]');
    this.description = this.node.querySelector('textarea');
    this.node.setAttribute('data-action', 'add');
    this.node.classList.add('hidden');
  }

  reset() {
    this.node.classList.add('fade-out');
    setTimeout(() =>  {
      this.node.reset();
      this.node.setAttribute('data-action', 'add');
      this.node.removeAttribute('data-id');
      this.node.classList.add('hidden')
    }, 400); 

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

  todoNotCompleted() {
    return this.completed() === "false";
  }
}

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

  getDateListItems() {
    return this.allTodosDates().concat(this.completedTodosDates());
  }

  resetHighlight() {
    this.highlighted = 'All Todos';
    this.activeSection = 'all';
  }

  removeHighlights() {
    document.querySelectorAll('li.highlighted').forEach(li => {
      li.classList.remove('highlighted');
    });
  }

  highlight() {
    const lis = Array.from(this.node.querySelectorAll(`li[data-section="${this.activeSection}"]`))
    const filtered = lis.filter(node => node.firstElementChild.getAttribute('data-title') === this.highlighted)[0]
    if (filtered) filtered.classList.add('highlighted');
  }

  updateProperties(node) {
    this.activeSection = node.parentNode.getAttribute('data-section');
    this.highlighted = node.getAttribute('data-title');
  }
}

export { TodoManager, 
         TodoList, 
         Todo, 
         DatabasePersistence, 
         Modal, 
         Nav };
         