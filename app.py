# app.py
from flask import Flask, render_template, request, jsonify
from sudoku import generate_sudoku, remove_numbers, get_solution, provide_hint
import numpy as np

app = Flask(__name__)

# Difficulty mapping
DIFFICULTY_LEVELS = {
    "easy": 30,
    "medium": 40,
    "hard": 50
}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/new/<level>', methods=['GET'])
def api_new(level):
    level_count = DIFFICULTY_LEVELS.get(level, 30)
    full = generate_sudoku()
    puzzle = remove_numbers(full, level=level_count)
    # return puzzle and solution so client can use hints if needed
    solution = get_solution(puzzle.copy())
    return jsonify({
        'board': puzzle.tolist(),
        'solution': solution.tolist() if solution is not None else None
    })

@app.route('/api/solve', methods=['POST'])
def api_solve():
    data = request.json
    board = np.array(data.get('board', []), dtype=int)
    if board.shape != (9,9):
        return jsonify({'error': 'Board must be 9x9'}), 400
    solvable = get_solution(board.copy())
    if solvable is not None:
        return jsonify({'solved': solvable.tolist()})
    else:
        return jsonify({'error': 'No solution exists'}), 400

@app.route('/api/hint', methods=['POST'])
def api_hint():
    data = request.json
    board = np.array(data.get('board', []), dtype=int)
    if board.shape != (9,9):
        return jsonify({'error': 'Board must be 9x9'}), 400
    hint = provide_hint(board)
    if hint:
        r,c,v = hint
        return jsonify({'row': r, 'col': c, 'value': v})
    return jsonify({'error': 'No hint available'}), 400

if __name__ == "__main__":
    app.run(debug=True)
