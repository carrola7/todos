"use strict"

class App {
  constructor() {
    this.configureTemplates();
    this.storage = new DatabasePersistence();
    this.storage.findAllTodos().then(todos => {
      this.todoList = new TodoList(todos);
      this.todoManager = new TodoManager(this.todoList);
      this.currentlyVisible = 'all';
      this.renderTodoPage();
      this.refreshSummaries()
    }); 
    this.modal = new Modal(this.templates.modal);

    const allTodosUL = document.querySelector('#allTodos')
    this.allTodosSummary = new SummaryList(allTodosUL, this.templates.todoDates);

    const completedTodosUL = document.querySelector('#completedTodos')
    this.completedTodosSummary = new SummaryList(completedTodosUL, this.templates.todoDates);

    this.todoListElement = document.getElementById('todoList'); 

    this.bind();
  }

  configureTemplates() {
    this.registerTemplates();
    this.registerPartials();
    this.registerHelpers();
  }

  registerTemplates() {
    const templates = {};
    const sources = document.querySelectorAll('script[type="text/x-handlebars"]');
    sources.forEach(source => {
      templates[source.getAttribute('id')] = Handlebars.compile(source.innerHTML);
    });
    this.templates = templates;
  }

  registerPartials() {
    const sources = document.querySelectorAll('script[data-type="partial"]');
    sources.forEach(source => {
      Handlebars.registerPartial(source.getAttribute('id'), source.innerHTML);
    });
  }

  registerHelpers() {
    this.registerDueDateHelper();
    this.registerStringifyHelper();
  }

  registerDueDateHelper() {
    Handlebars.registerHelper('dueDate', function(todo) {
      if(todo.month && todo.year) {
        return `${todo.month}/${todo.year.slice(-2)}`;
      } else {
        return "No Due Date";
      }
    });
  }

  registerStringifyHelper() {
    Handlebars.registerHelper('stringify', function(todo) {
      return JSON.stringify(todo);
    });
  }

  renderTodoPage() {
    const todos = this.findVisibleTodos()
    this.renderTodoList(todos);
    this.renderTodoCount(todos.length);
  }

  findVisibleTodos() {
    switch (this.currentlyVisible) {
      case 'all':
        return this.todoManager.allTodos();
        break;
      case 'completed':
        return this.todoManager.completedTodos();
        break;
      default:
        return this.findDateRestrictedTodos();
        break;
    }
  }

  findDateRestrictedTodos() {
    const currentlyVisible = this.currentlyVisible;
    if(currentlyVisible.completed === "false") {
      return this.todoManager.todosInMonthYear(currentlyVisible.month, currentlyVisible.year);
    } else {
      return this.todoManager.completedTodosInMonthYear(currentlyVisible.month, currentlyVisible.year);
    }
  }

  handleAllTodoClick() {
    this.setHeading('All Todos');
    this.currentlyVisible = 'all';
    this.renderTodoPage();
  }

  renderTodoList(todos) {
    const html = this.templates.todoItems({ todos: todos });
    this.todoListElement.innerHTML = html;
  }


  renderTodoCount(count) {
    document.querySelector('span.active-todos').textContent = count;
  }

  renderCompletedTodos() {
    this.currentlyVisible = 'completed';
    this.setHeading('Completed');
    this.renderTodoPage();
    // this.renderTodoList(completed);
    // this.renderTodoCount(completed.length);
  }

  setHeading(newHeading) {
    document.querySelector('#todoPage h1').firstChild.textContent = newHeading;
  }

  bind() {
    document.getElementById('todoPage').onclick = this.handleTodoPageClick.bind(this);
    document.onclick = this.handleDocumentClick.bind(this);
    this.modal.node.onsubmit = this.handleModalSubmit.bind(this);
    this.modal.node.onclick = this.handleModalClick.bind(this);
    document.querySelector('section.all-todos h2').onclick = this.handleAllTodoClick.bind(this);
    document.querySelector('section.completed h2').onclick = this.renderCompletedTodos.bind(this);
    this.allTodosSummary.node.onclick = this.handleAllTodoSummaryClick.bind(this);
    this.completedTodosSummary.node.onclick = this.handleCompletedTodoSummaryClick.bind(this);

  }

  handleTodoPageClick(event) {
    console.log(event.target.tagName);
    switch (event.target.tagName) {
      case 'A':
        this.handleAnchorClick(event);
        break;
      case 'DIV':
      case 'SPAN':
        this.toggleTodo(event.target.getAttribute('data-id'));
        break;
      case 'LABEL':
        event.stopPropagation();
        this.showModalFor(event.target.getAttribute('data-todo'));
        break;
    }
  }

  handleDocumentClick(event) {
    switch (event.target.tagName) {
      case 'FORM':
        this.handleFormClick(event);
        break;
    }
  }

  handleAnchorClick(event) {
    event.preventDefault();
    const a = event.target;
    switch (a.getAttribute('data-action')) {
      case "newTodo":
        this.modal.show();
        break;
      case "deleteTodo":
        const id = a.getAttribute('data-id');
        this.deleteTodo(id);                                    
        break;
    }
  }

  toggleTodo(id) {
    this.storage.toggleTodo(id)
                .then((todo) => {
                  this.todoList.update(+id, todo);
                  this.renderTodoPage();
                  this.refreshCompletedTodosSummary();
                })
                .catch(message => console.error(message));
  }

  deleteTodo(id) {
    this.storage.deleteTodo(id).then(() => {
                                  this.todoList.deleteTodo(+id);
                                  this.renderTodoPage();
                                  this.refreshSummaries();
                                });
  }

  showModalFor(todo) {
    todo = JSON.parse(todo);
    this.modal.update(todo);
    this.modal.show();
  }

  handleFormClick(event) {
    if(event.target.className.includes('modal')) {
      event.preventDefault();
      this.modal.reset();
    }
  }

  handleModalSubmit(event) {
    event.preventDefault();
    const input = document.querySelector('input[name="title"]');
    if (input.value.length < 3) {
      alert("The title must have at least three characters");
      return;
    }
    let props;
    switch (event.target.getAttribute('data-action')) {
      case 'add':
        props = this.extractTodoProps(event.target);
        this.addTodo(props);
        break;
      case 'update':
        props = this.extractTodoProps(event.target);
        this.updateTodo(this.modal.id(), props);
        this.modal.reset();
    }
  }

  handleModalClick(event) {
    if (event.target.getAttribute('name') === "completed") {
      const id = this.modal.id();
      this.updateTodo(id, {completed: true});
    }
  }

  handleMarkTodoAsCompleted() {
    if (this.modal.isForNewTodo()) {
      alert("Cannot mark as complete as item has not been created yet!");
    } else {
      this.toggleTodo(this.modal.id());
      this.modal.reset();
    }
  }

  handleAllTodoSummaryClick(event) {
    event.preventDefault();
    let currentNode = event.target;
    while (currentNode.tagName != 'A' && currentNode.parentNode != null) {
      currentNode = currentNode.parentNode;
    }

    if (currentNode.tagName === 'A') {
      const searchCriteria = this.extractSearchCriteria(currentNode);
      //const todos = this.todoList.matchingTodos(searchCriteria);
      this.currentlyVisible = searchCriteria;
      this.renderTodoPage();
      const newHeading = currentNode.getAttribute('data-title');
      this.setHeading(newHeading);
    }
  }

  handleCompletedTodoSummaryClick(event) {
    event.preventDefault();
    let currentNode = event.target;
    while (currentNode.tagName != 'A' && currentNode.parentNode != null) {
      currentNode = currentNode.parentNode;
    }

    if (currentNode.tagName === 'A') {
      const searchCriteria = this.extractSearchCriteria(currentNode)
      //const matching = this.todoList.matchingTodos(searchCriteria);
      this.currentlyVisible = searchCriteria;
      this.renderTodoPage();
      const newHeading = currentNode.getAttribute('data-title');
      this.setHeading(newHeading);
    }
  }

  extractSearchCriteria(node) {
    const year = node.getAttribute('data-year') || null;
    const month = node.getAttribute('data-month') || null;
    const completed = node.getAttribute('data-completed');
    const searchCriteria = { month: month, year: year, completed: completed };
    return searchCriteria;
  }

  extractTodoProps(form) {
    const props = {};
    const formData = new FormData(form);
    for(var pair of formData.entries()) {
      props[pair[0]] = pair[1];
    }

    return props;
  }

  addTodo(props) {
    this.storage.add(props)
                .then(todo => {
                  this.todoList.addTodo(todo);
                  this.modal.reset();
                  this.renderTodoPage();
                  this.refreshSummaries();
                })
                .catch(message => console.error(message));
  }

  updateTodo(id, props) {
    this.storage.update(id, props)
                .then(todo => {
                  this.todoList.update(+id, todo);
                  this.modal.reset();
                  this.renderTodoPage();
                  this.refreshCompletedTodosSummary();
                })
                .catch(message => console.error(message));
  }

  refreshSummaries() {
    this.refreshAllTodosSummary();
    this.refreshCompletedTodosSummary();
  }

  refreshAllTodosSummary() {
    const allTodos = this.todoManager.allTodos();
    const todos = this.findUniquelyDated(allTodos);
    this.allTodosSummary.refresh(todos);
    this.allTodosSummary.listItems().forEach(li => this.updateCount(li));
    const counter = document.querySelector('section.all-todos h2 span');
    counter.textContent = allTodos.length;
  }

  refreshCompletedTodosSummary() {
    const completedTodos = this.todoManager.completedTodos();
    const todos = this.findUniquelyDated(completedTodos);
    this.completedTodosSummary.refresh(todos);
    this.completedTodosSummary.listItems().forEach(li => this.updateCount(li, true));
    const counter = document.querySelector('section.completed h2 span');
    counter.textContent = completedTodos.length;
  }

  updateCount(li, forCompleted = false) {
    const year = li.firstElementChild.getAttribute('data-year') || null;
    const month = li.firstElementChild.getAttribute('data-month') || null;
    const searchCriteria = { month: month, year: year };
    if (forCompleted)  {
      searchCriteria['completed'] = true;
    } 
    const matching = this.todoList.matchingTodos(searchCriteria);
    const dd = li.querySelector('dd');
    dd.textContent = matching.length;
  }

  findUniquelyDated(todos) {
    function byDate(currentTodo, nextTodo) {
      if (+currentTodo.year === +nextTodo.year) {
        return +currentTodo.month - +nextTodo.month; 
      } else {
        return +currentTodo.year - +nextTodo.year;
      }
    }

    const filtered = [];
    todos.forEach(todo => {
      let seen = filtered.some(filteredTodo => {
        return todo.year === filteredTodo.year &&
               todo.month === filteredTodo.month;
      });
      if (!seen) filtered.push(todo);
    });
    return filtered.sort(byDate);
  }
}

var app;
document.addEventListener('DOMContentLoaded', function() {
  app = new App();
})