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

      return completed.concat(uncompleted);
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

class TodoListElement {
  constructor(node) {
    this.node = node;
  }

  setContent(html) {
    this.node.innerHTML = html;
  }

  add(todo) {
    
  }
}

class DatabasePersistence {
  constructor() {
    this.findAllAction = "/api/todos";
    this.findAllMethod = "GET";
    this.addTodoAction = "/api/todos";
    this.addTodoMethod = "POST";
  }

  findAllTodos() {
   return new Promise(resolve => {
    const xhr = new XMLHttpRequest();
    xhr.open(this.findAllMethod, this.findAllAction);
    xhr.responseType = 'json';
    xhr.onload = () => resolve(xhr.response);
    xhr.send();
   });
 }

  add(props) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(this.addTodoMethod, this.addTodoAction);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.responseType = 'json';
      xhr.onload = () => {
        console.log(xhr.status);
        console.log(typeof xhr.status)
        switch(xhr.status) {
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
}